#!/usr/bin/env bash
# ==============================================================================
# Bagian 4: Simulasi Uji Gangguan & Resiliensi (Chaos Simulation)
# Durasi Demo: Menit 15:00 – 22:00
#
# Tahapan Simulasi:
#   1. Fault-Injection: Mematikan kontainer pekerja (consumer) dengan `docker stop`
#   2. Menerbitkan beberapa transaksi baru (+ 1 duplikat) dari sisi produsen
#   3. Menampilkan bukti Queue Buffering / Temporal Decoupling (RabbitMQ Port 15672)
#   4. Menyalakan kembali kontainer pekerja (`docker start`) & membuktikan:
#      - Zero Message Loss (seluruh pesan di antrean terproses hingga Ready = 0)
#      - Idempotency (pesan duplikat ditolak oleh Deduplication Guard tanpa mutasi ganda)
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

AUTO_MODE=false
TARGET_CONTAINERS=("medcore-pharmacy-worker" "medcore-billing-worker")

for arg in "$@"; do
  case "$arg" in
    --auto|-y)
      AUTO_MODE=true
      ;;
    medcore-*)
      TARGET_CONTAINERS=("$arg")
      ;;
  esac
done

# Warna output terminal
C_RESET='\033[0m'
C_BOLD='\033[1m'
C_CYAN='\033[1;36m'
C_GREEN='\033[1;32m'
C_YELLOW='\033[1;33m'
C_RED='\033[1;31m'

banner() {
  echo -e "\n${C_CYAN}==============================================================================${C_RESET}"
  echo -e "${C_BOLD}$1${C_RESET}"
  echo -e "${C_CYAN}==============================================================================${C_RESET}"
}

pause_step() {
  if [ "$AUTO_MODE" = false ]; then
    echo -e "\n${C_YELLOW}[PAUSE] $1${C_RESET}"
    read -r -p "Tekan [ENTER] untuk melanjutkan ke tahap berikutnya..."
  else
    sleep 2
  fi
}

# Event ID valid (UUID v4 dengan prefix evt-) untuk 3 transaksi baru
EVT_1="evt-44444444-4444-4444-8444-444444444001"
EVT_2="evt-44444444-4444-4444-8444-444444444002"
EVT_3="evt-44444444-4444-4444-8444-444444444003"

# Fungsi helper query MongoDB (Pharmacy DB)
mongo_eval() {
  docker exec -i medcore-pharmacy-db sh -c \
    'mongosh --quiet -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin medcore_pharmacy_db --eval "$1"' \
    sh "$1"
}

# Fungsi helper query MySQL (Billing DB)
mysql_eval() {
  docker exec -i medcore-billing-db sh -c \
    'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=tcp -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" -t -e "$1"' \
    sh "$1"
}

# Fungsi helper status antrean RabbitMQ
show_rabbitmq_queues() {
  docker exec -i medcore-message-broker sh -c \
    'rabbitmqadmin -u "$RABBITMQ_DEFAULT_USER" -p "$RABBITMQ_DEFAULT_PASS" -V "$RABBITMQ_DEFAULT_VHOST" list queues name messages_ready messages_unacknowledged messages consumers'
}

# Fungsi helper menjalankan producer (appointment-service)
publish_event() {
  local evt_id="$1"
  local label="$2"
  echo -e "\n${C_BOLD}-> Menerbitkan ${label} (EVENT_ID=${evt_id})...${C_RESET}"
  if command -v go >/dev/null 2>&1; then
    (cd "$ROOT_DIR/services/appointment-service" && EVENT_ID="$evt_id" go run main.go)
  else
    docker compose -f docker-compose.tools.yml run --rm -T --no-deps \
      -e EVENT_ID="$evt_id" \
      -e RABBITMQ_URI="amqp://admin_medcore:SecuredPassRabbit2026!@172.28.0.20:5672/medcore_vhost" \
      tools sh -c "cd services/appointment-service && go run main.go"
  fi
}

# ==============================================================================
# TAHAP 0: PERSIAPAN & BASELINE STATE
# ==============================================================================
banner "TAHAP 0: PERSIAPAN TOPOLOGI & RESET BASELINE DATA SIMULASI"

echo "1. Memastikan topologi RabbitMQ & tabel deduplikasi Billing siap..."
sh ./scripts/setup_rabbitmq_topology.sh >/dev/null
sh ./scripts/migrate_billing.sh >/dev/null

echo "2. Memastikan kontainer pekerja aktif sebelum simulasi dimulai..."
docker start "${TARGET_CONTAINERS[@]}" >/dev/null 2>&1 || true
sleep 2

echo "3. Mereset state data uji Chaos agar metrik stok & invoice presisi..."
mongo_eval "
  db.drugs.updateOne({ drug_code: 'MED-AMX-500' }, { \$set: { total_stock: 500 } });
  db.processed_events.deleteMany({ event_id: { \$in: ['$EVT_1', '$EVT_2', '$EVT_3'] } });
" >/dev/null

docker exec -i medcore-billing-db sh -c \
  'MYSQL_PWD="$MYSQL_PASSWORD" mysql --protocol=tcp -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE"' <<SQL >/dev/null
DELETE FROM invoices WHERE invoice_id IN (
  SELECT invoice_id FROM processed_events WHERE event_id IN ('$EVT_1', '$EVT_2', '$EVT_3')
);
DELETE FROM processed_events WHERE event_id IN ('$EVT_1', '$EVT_2', '$EVT_3');
SQL

echo -e "\n${C_GREEN}[BASELINE DATABASE SEBELUM GANGGUAN]${C_RESET}"
echo "--- MongoDB (medcore-pharmacy-db) ---"
mongo_eval "
  const drug = db.drugs.findOne({ drug_code: 'MED-AMX-500' }, { _id: 0, drug_code: 1, name: 1, total_stock: 1 });
  const processed = db.processed_events.countDocuments({ event_id: { \$in: ['$EVT_1', '$EVT_2', '$EVT_3'] } });
  print('Stok Awal MED-AMX-500        :', drug.total_stock);
  print('Chaos Events Terproses ( Awal):', processed);
"
echo "--- MySQL (medcore-billing-db) ---"
mysql_eval "SELECT COUNT(*) AS chaos_invoices_before FROM processed_events WHERE event_id IN ('$EVT_1', '$EVT_2', '$EVT_3');"

echo "--- Status Antrean RabbitMQ Saat Ini ---"
show_rabbitmq_queues

pause_step "Baseline siap. Selanjutnya kita akan mematikan kontainer pekerja (Fault-Injection)."

# ==============================================================================
# TAHAP 1: UJI PEMADAMAN LAYANAN (FAULT-INJECTION)
# ==============================================================================
banner "TAHAP 1: UJI PEMADAMAN LAYANAN / FAULT-INJECTION (docker stop)"

echo -e "Menjalankan perintah: ${C_RED}docker stop ${TARGET_CONTAINERS[*]}${C_RESET}"
docker stop "${TARGET_CONTAINERS[@]}"

echo -e "\nStatus kontainer pekerja setelah dimatikan:"
docker ps -a --filter "name=medcore-pharmacy-worker" --filter "name=medcore-billing-worker" --filter "name=medcore-notification-worker" \
  --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

pause_step "Kontainer pekerja telah mati (Exited). Selanjutnya kita akan menerbitkan transaksi dari Produsen."

# ==============================================================================
# TAHAP 2: MENERBITKAN TRANSAKSI BARU (+ DUPLIKAT) DARI SISI PRODUSEN
# ==============================================================================
banner "TAHAP 2: MENERBITKAN 3 TRANSAKSI BARU + 1 DUPLIKAT DARI PRODUSEN (Appointment Service)"

publish_event "$EVT_1" "Transaksi #1 (Unik - Resep 15x MED-AMX-500, Fee Rp150.000)"
publish_event "$EVT_2" "Transaksi #2 (Unik - Resep 15x MED-AMX-500, Fee Rp150.000)"
publish_event "$EVT_3" "Transaksi #3 (Unik - Resep 15x MED-AMX-500, Fee Rp150.000)"
publish_event "$EVT_1" "Transaksi #4 (DUPLIKAT/RETRY dari Transaksi #1 untuk Uji Idempotensi)"

echo -e "\n${C_GREEN}Produsen berhasil menerbitkan 4 pesan (3 unik + 1 duplikat) tanpa error meskipun Consumer sedang mati!${C_RESET}"

# ==============================================================================
# TAHAP 3: VERIFIKASI QUEUE BUFFERING / TEMPORAL DECOUPLING (PORT 15672)
# ==============================================================================
banner "TAHAP 3: BUKTI QUEUE BUFFERING / TEMPORAL DECOUPLING (RabbitMQ Port 15672)"

echo -e "Status Antrean di RabbitMQ (Perhatikan kolom ${C_YELLOW}messages_ready = 4${C_RESET} dan ${C_YELLOW}consumers = 0${C_RESET}):"
show_rabbitmq_queues

echo -e "\n${C_YELLOW}>>> PANDUAN TAMPILAN RABBITMQ MANAGEMENT DASHBOARD (Port 15672) <<<${C_RESET}"
echo "1. Buka browser ke: http://localhost:15672"
echo "2. Login menggunakan: Username = admin_medcore | Password = SecuredPassRabbit2026!"
echo "3. Buka tab 'Queues and Streams' (vhost: medcore_vhost):"
echo "   - Antrean 'pharmacy.prescription.order.q' & 'billing.invoice.q' memiliki:"
echo "     * Ready     = 4 pesan (tertahan aman di disk / persistent queue buffering)"
echo "     * Unacked   = 0"
echo "     * Consumers = 0 (karena kontainer pekerja sedang dimatikan)"

echo -e "\nVerifikasi Database saat kontainer pekerja masih mati (Belum ada mutasi):"
mongo_eval "
  const drug = db.drugs.findOne({ drug_code: 'MED-AMX-500' });
  const processed = db.processed_events.countDocuments({ event_id: { \$in: ['$EVT_1', '$EVT_2', '$EVT_3'] } });
  print('Stok MED-AMX-500 saat worker mati  :', drug.total_stock, '(Tetap 500)');
  print('Chaos Events di MongoDB saat mati  :', processed, '(Tetap 0)');
"
mysql_eval "SELECT COUNT(*) AS chaos_invoices_while_stopped FROM processed_events WHERE event_id IN ('$EVT_1', '$EVT_2', '$EVT_3');"

pause_step "Tunjukkan RabbitMQ Dashboard (Port 15672) dengan Ready = 4 ke kamera/audiens. Tekan ENTER untuk menyalakan kembali kontainer pekerja."

# ==============================================================================
# TAHAP 4: PEMULIHAN LAYANAN (docker start), ZERO MESSAGE LOSS & IDEMPOTENSI
# ==============================================================================
banner "TAHAP 4: PEMULIHAN KONTAINER PEKERJA (docker start) & VERIFIKASI AKHIR"

START_TS="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo -e "Menjalankan perintah: ${C_GREEN}docker start ${TARGET_CONTAINERS[*]}${C_RESET}"
docker start "${TARGET_CONTAINERS[@]}"

echo "Menunggu kontainer pekerja memproses seluruh antrean (3 detik)..."
sleep 3

echo -e "\n${C_CYAN}1. Status Antrean RabbitMQ Setelah Worker Menyala Kembali (Zero Message Loss -> Ready = 0):${C_RESET}"
show_rabbitmq_queues

echo -e "\n${C_CYAN}2. Log Kontainer Pekerja (Bukti Pemrosesan & Idempotency Guard):${C_RESET}"
for c in "${TARGET_CONTAINERS[@]}"; do
  echo -e "\n--- Log ${c} ---"
  docker logs --since "$START_TS" "$c" 2>&1 | tail -n 25
done

echo -e "\n${C_CYAN}3. Bukti Basis Data MongoDB (Pharmacy Service):${C_RESET}"
echo "   - 3 Transaksi unik x 15 obat = 45 unit dipotong (500 -> 455)"
echo "   - 1 Transaksi duplikat ($EVT_1) DIABAIKAN oleh Idempotency Guard (stok TIDAK terpotong jadi 440!)"
mongo_eval "
  const drug = db.drugs.findOne({ drug_code: 'MED-AMX-500' }, { _id: 0, drug_code: 1, name: 1, total_stock: 1 });
  printjson(drug);
  print('\nDokumen pada koleksi processed_events (MongoDB):');
  db.processed_events.find({ event_id: { \$in: ['$EVT_1', '$EVT_2', '$EVT_3'] } }, { _id: 0 }).forEach(doc => printjson(doc));
"

echo -e "\n${C_CYAN}4. Bukti Basis Data MySQL (Billing Service):${C_RESET}"
echo "   - Tepat 3 invoice baru terbuat untuk 3 event unik (tidak ada tagihan ganda untuk $EVT_1):"
mysql_eval "
SELECT
  pe.event_id,
  pe.invoice_id,
  i.appointment_id,
  i.total_amount,
  i.payment_status,
  pe.processed_at
FROM processed_events pe
JOIN invoices i ON i.invoice_id = pe.invoice_id
WHERE pe.event_id IN ('$EVT_1', '$EVT_2', '$EVT_3')
ORDER BY pe.event_id;
"

banner "SIMULASI BAGIAN 4 SELESAI: ZERO MESSAGE LOSS & IDEMPOTENCY TERBUKTI!"

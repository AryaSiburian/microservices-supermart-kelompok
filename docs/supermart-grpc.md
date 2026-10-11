# Integrasi Order dan Inventory untuk Tugas 2

Implementasi ini menyediakan provider Inventory terpisah dengan REST HTTP/1.1 dan
gRPC HTTP/2. Checkout pada backend Supermart menggunakan klien gRPC untuk satu
reservasi batch, bukan pemanggilan `inventory.Service` dalam proses yang sama.
Tidak ada perubahan pada `medcore-workspace`.

## Jalankan layanan lokal

Prasyarat: Docker Engine, Docker Compose v2 dan Python 3 pada host Linux. Build
memakai Go 1.26.4 sesuai `backend/go.mod`; Go tidak harus terpasang pada host.
Dari root repositori:

```sh
docker compose -f docker-compose.supermart-grpc.yml up -d --build mysql inventory backend
docker compose -f docker-compose.supermart-grpc.yml ps
curl --http1.1 http://127.0.0.1:8081/health
python3 scripts/supermart-smoke.py
```

Port host: backend `3001`, Inventory REST `8081`, Inventory gRPC `50051`, MySQL
`3310`. Semua port host hanya terikat pada loopback. Project/volume
`supermart-tugas2` terpisah dari container layanan dan MedCore yang sudah ada.
Fixture di `deployment/supermart/03-fixture.sql` membuat produk uji, dua gudang,
dan dependensi minimum checkout. Kedua protokol membaca database dan query yang
sama. Produk pertama memiliki 120 unit on-hand dan 2 reserved: tersedia 118.

Seed hanya dijalankan saat volume baru pertama dibuat. Untuk database legacy
yang sudah berisi data, jalankan `deployment/supermart/02-inventory-grpc.sql`
sekali setelah backup; jangan menjalankan fixture pada database bisnis. Migrasi
menambah `stock_id` pada catatan reservasi, indeks lookup dan tabel pengunci
request. Jangan menebak gudang reservasi lama: catatan HOLD tanpa `stock_id`
memerlukan rekonsiliasi sebelum bisa dilepas oleh jalur baru.

Untuk instalasi Go lokal, setelah database dan migrasi tersedia:

```sh
cd backend
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3310 go run ./cmd/inventory-server
```

Pada terminal kedua:

```sh
cd backend
MYSQL_HOST=127.0.0.1 MYSQL_PORT=3310 APP_PORT=3001 INVENTORY_GRPC_TARGET=127.0.0.1:50051 go run .
```

Konfigurasi kredensial/database memakai variabel `MYSQL_*` yang sudah ada. Alamat
provider memakai `INVENTORY_REST_ADDR` dan `INVENTORY_GRPC_ADDR`. Alamat klien
Order memakai `INVENTORY_GRPC_TARGET`. Provider standalone lokal default terikat
pada `127.0.0.1`; Compose memakai alamat internal container.

## Kontrak dan operasi

Kontrak berada di `proto/inventory/v1/inventory.proto`, package
`supermart.inventory.v1`, dengan `go_package` sesuai module
`github.com/nusantara-supermart/backend`. Kode generated berada dalam
`backend/gen/inventory/v1/` agar termasuk dalam module backend.

| Operasi | Input | Respons sukses |
|---|---|---|
| `CheckStock` | `product_id`, `warehouse_id` | ID produk/gudang, `available_qty`, `in_stock` |
| `ReserveStockBatch` | `reference_order_id`, `warehouse_id`, daftar produk/quantity | ID order, `all_reserved=true` |
| `ReleaseStockBatch` | `reference_order_id` | `released=true` |

Jumlah permintaan per batch dibatasi 100 line items. Duplicate produk digabung
dan quantity hasil agregasi tidak boleh melewati int32. Kuantitas masing-masing
item memakai int32, sedangkan total stok tersedia memakai int64 untuk agregasi
beberapa baris stok/batch. Kontrak tidak membawa harga atau float/double.
Aturan penomoran tag, deprecation dan reserved tertulis dalam kontrak. Tipe/tag
lama tidak diganti; field baru harus toleran terhadap default dari producer lama.

REST pembanding berada pada provider:

```text
GET http://127.0.0.1:8081/api/v1/inventory/check-stock?product_id=p0000001-0000-0000-0000-000000000001&warehouse_id=w0000001-0000-0000-0000-000000000001
```

JSON menggunakan nama field proto dan keempat informasi yang sama, tanpa
envelope tambahan. `available_qty` direpresentasikan sebagai string desimal oleh
ProtoJSON untuk menjaga presisi int64. Tidak ada auth/TLS/compression pada kedua
endpoint lab privat; port loopback tidak ditujukan untuk deployment publik.
Endpoint legacy `/api/v1/inventory/stocks` beserta auth dan operasi admin tetap
ada pada backend.

Regenerasi/kompilasi proto dengan compiler dan plugin yang dipasang di image tools:

```sh
docker build -t supermart-tugas2-tools:local -f deployment/supermart/Dockerfile.tools .
docker run --rm --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$PWD:/workspace" -w /workspace supermart-tugas2-tools:local sh scripts/supermart-generate-proto.sh
```

## Atomicity dan kompensasi

Setiap reservasi batch memakai satu transaksi InnoDB. Provider mengunci kunci
order dan stok dengan `FOR UPDATE`, mengurutkan produk/baris secara konsisten,
memeriksa ketersediaan, lalu mengalokasikan stok ke baris/batch yang tepat. Bila
satu item atau insert reservasi gagal, rollback mencakup perubahan item sebelumnya
dan metadata request. Keberhasilan hanya dikirim setelah commit selesai.

`reference_order_id` adalah idempotency key. Hash payload ternormalisasi mencegah
pemakaian key yang sama untuk isi berbeda. Permintaan ulang identik tidak membuat
hold kedua. Kompensasi menurunkan `quantity_reserved` hanya pada `stock_id` yang
dicatat, lalu mengubah status dalam transaksi yang sama. Permintaan release yang
diulang tidak mengurangi stok lagi. Release sebelum Reserve membuat tombstone
untuk mencegah RPC terlambat menghidupkan reservasi kembali.

Jika reservasi RPC gagal/timeout, Order mengirim release dengan ID yang sama untuk
menangani hasil commit yang tidak diketahui. Jika penyimpanan order gagal, Order
memeriksa keberadaan order sebelum release. Order yang ternyata sudah committed
tetap mempertahankan hold. Error pada commit ditandai sebagai hasil tidak pasti;
query yang belum menemukan order tidak membuktikan commit yang terlambat gagal.
Jika hasil commit belum teramati atau database tidak dapat memastikan hasil save,
hold dipertahankan dan error/log `RECONCILIATION_REQUIRED` mencantumkan ID order.
Release dicoba maksimal tiga kali; kegagalan dilaporkan sebagai
`COMPENSATION_REQUIRED`, bukan diabaikan.

Ini atomicity di database Inventory, bukan transaksi terdistribusi antara Order
dan Inventory. Tidak ada durable saga/outbox untuk crash di antara reserve dan
save; kasus crash/kegagalan kompensasi permanen memerlukan rekonsiliasi berdasarkan
ID order. Pemisahan seluruh database/domain legacy juga tidak dikerjakan: dua
proses masih memakai MySQL legacy yang sama agar endpoint admin dan checkout
mengakses stok yang konsisten. Batas ini harus dinyatakan pada laporan.

## Pengujian dan benchmark

Build/test/vet, termasuk uji integrasi terhadap database fixture nyata:

```sh
sh scripts/supermart-test.sh
python3 scripts/supermart-smoke.py
```

Pengujian Inventory akan SKIP bila `SUPERMART_TEST_DSN` tidak diberikan saat
`go test` biasa. Skrip di atas memasangnya ke database Compose khusus pengujian.
Tes membuat data produk/stok sementara dan menghapusnya kembali. Kasus mencakup
REST/gRPC setara, invalid/not-found, rollback parsial, retry idempotent, release
dua kali, gudang lain tidak berubah, RPC terlambat, agregasi multi-batch dan
konkurensi tanpa overselling. Tes Order memakai socket TCP gRPC nyata untuk
memeriksa jalur network dan berbagai hasil save/kompensasi. Smoke test membuat
akun/alamat/cart fixture, checkout gagal, checkout sukses dan cancellation.

Jalankan empat benchmark wajib:

```sh
python3 scripts/supermart-benchmark.py --run-id laporan-tugas2
```

Gunakan ID run baru setiap kali. Lokasi hasil:
`benchmarks/supermart/results/laporan-tugas2/`. Berkas `environment.json` mencatat
hostname, CPU, RAM, OS, commit, hash proto, image server dan container lain yang
berjalan. Masing-masing protokol/beban menghasilkan `.json`, `.log` terminal dan
`-resources.json`; tabel gabungan serta persentase selisih ada di `summary.md`.
Simpan screenshot terminal asli yang memperlihatkan hostname dan tabel metrik.
Skrip tidak membuat screenshot atau angka pengukuran sintetis.

Driver Go memakai closed-loop workers tanpa think time: satu permintaan in-flight
per worker, 50 selama 30 detik dan 200 selama 60 detik, dengan warmup 2 detik yang
dikecualikan. Worker boleh menyelesaikan request terakhir setelah durasi target;
durasi aktual dicatat dan menjadi penyebut RPS. REST memakai pool keep-alive
HTTP/1.1 (driver menolak respons protokol lain); gRPC memakai satu koneksi
persistent HTTP/2 untuk multiplexing worker. Kedua protokol memanggil query SQL
yang sama untuk produk/gudang yang sama. Setiap respons harus sama dengan data
preflight; perubahan stok/kegagalan request membuat benchmark berstatus gagal.

Payload adalah panjang body JSON versus ukuran pesan Protobuf serialized,
tidak termasuk HTTP headers, TLS, HTTP/2 framing atau envelope gRPC 5 byte.
Latensi termasuk decoding dan validasi di klien; ini benchmark aplikasi, bukan
pengukuran overhead transport terisolasi. Percentile memakai nearest rank atas
seluruh request sukses. RPS adalah throughput sukses yang diamati pada beban ini,
bukan jaminan kapasitas maksimum sistem.

CPU/memory diambil dari `docker stats` untuk container provider Inventory saja,
pada interval benchmark yang dicatat driver. CPU raw 100% setara satu logical
core, sehingga CPU host = raw / jumlah logical CPU. Memory adalah working set
Docker dan dapat terbawa dari run sebelumnya karena allocator/cache. Load
generator, database, dan workload lain berbagi host; ulangi pengukuran beberapa
kali untuk menilai variasi. Jangan mengasumsikan CPU database termasuk CPU server.

Provider Inventory mempertahankan maksimal 25 koneksi database aktif dan idle.
Pada percobaan awal, batas idle 10 menyebabkan koneksi TCP terus dibuka dan
ditutup hingga port sementara habis. Penyesuaian pool ini hanya berlaku pada
provider baru; percobaan yang gagal disimpan lokal. Hanya run lengkap dengan nol
error yang dipublikasikan sebagai bukti benchmark.

## Berkas implementasi

| Berkas | Tujuan |
|---|---|
| `proto/inventory/v1/inventory.proto` | Kontrak v1 dan aturan evolusi |
| `backend/gen/inventory/v1/*.pb.go` | Stub server/klien dan encoding generated |
| `backend/internal/inventory/sync.go` | Query read, transaksi batch, idempotency dan release |
| `backend/internal/inventory/transport.go` | Adapter gRPC dan REST dengan respons setara |
| `backend/internal/inventoryclient/client.go` | Klien network persistent dengan deadline RPC |
| `backend/cmd/inventory-server/main.go` | Menjalankan dua protokol dalam satu provider |
| `backend/internal/order/service.go` | Satu batch saat checkout dan kompensasi yang diperiksa |
| `backend/internal/order/repository.go` | Pemeriksaan hasil save order yang ambigu |
| `backend/main.go`, `backend/pkg/config/config.go`, `.env.example` | Wiring Order ke target gRPC |
| `backend/go.mod`, `backend/go.sum` | Dependensi gRPC/Protobuf |
| `backend/internal/inventory/sync_integration_test.go`, `backend/internal/order/service_test.go` | Verifikasi transaksi nyata dan jalur network |
| `backend/cmd/stock-benchmark/main.go` | Load generator dan pengukuran metrik |
| `deployment/supermart/02-inventory-grpc.sql`, `03-fixture.sql` | Migrasi minimum dan fixture yang sama untuk kedua protokol |
| `deployment/supermart/Dockerfile`, `Dockerfile.tools`, `docker-compose.supermart-grpc.yml` | Build dan runtime lokal terisolasi |
| `scripts/supermart-generate-proto.sh`, `supermart-test.sh`, `supermart-smoke.py`, `supermart-benchmark.py` | Perintah reproduksi dan pengambilan bukti |
| `docs/supermart-grpc.md` | Petunjuk, batas implementasi dan daftar perubahan |
| `benchmarks/supermart/results/` | Log, metrik dan lingkungan pengukuran asli; percobaan gagal diberi penanda |

## Verifikasi yang sudah dijalankan

Pada 12 Oktober 2026 (Asia/Taipei), kompilasi proto/generated stub, `go build
./...`, `go vet ./...` dan `go test -count=1 -v ./...` berhasil. Enam tes integrasi
Inventory memakai MySQL nyata, bukan SKIP. Tes checkout melalui socket TCP gRPC
memiliki tujuh subkasus, termasuk save gagal, kompensasi gagal terlihat, respons
commit hilang, commit belum teramati dan probe database gagal. Smoke test layanan
memverifikasi kegagalan item kedua, kegagalan save order karena foreign key,
checkout sukses dan cancellation yang mengembalikan stok.

Empat skenario benchmark selesai dengan nol error pada hostname `tayama`:
[hasil lengkap dan persentase perbandingan](../benchmarks/supermart/results/tugas2-20261012-final/summary.md).
Lingkungan aktual: Ubuntu 24.04.4 LTS, Ryzen 7 7735HS, 16 logical CPU, sekitar
14,81 GiB RAM dan Go 1.26.4. Gunakan `environment.json` sebagai sumber spesifikasi
Bagian III; jangan menyalin spesifikasi screenshot lama bila berbeda.

Sebelum mengisi laporan, ambil screenshot terminal asli dengan hostname, lalu
cantumkan metrik dan definisi payload/CPU dari hasil tersebut. Bagian IV perlu
membahas kontrak berversi, evolusi tag, batas transaksi Inventory, kompensasi dan
hasil pengukuran tanpa menyimpulkan gRPC selalu menang: p50 gRPC pada 50 worker
sedikit lebih lambat walaupun mean dan tail latency lebih rendah. Satu putaran
ini belum mengukur variasi antar-run; benchmark dapat diulang dengan ID baru.
Implementasi disimpan pada branch `feat/grpc-integration`.

Landasan implementasi: [gRPC Go](https://grpc.io/docs/languages/go/basics/),
[InnoDB locking reads](https://dev.mysql.com/doc/refman/8.0/en/innodb-locking-reads.html),
dan [ProtoJSON](https://protobuf.dev/programming-guides/json/).

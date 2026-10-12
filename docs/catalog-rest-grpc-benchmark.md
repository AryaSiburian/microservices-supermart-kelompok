# Benchmark REST vs gRPC Katalog

## Status dan batas klaim

Dokumen ini menyiapkan metodologi dan format pelaporan untuk perbandingan endpoint katalog. **Belum ada angka hasil benchmark**: tidak ada server gRPC katalog yang dapat dijalankan dari repositori ini saat dokumen dibuat, dan prasyarat pengujian lokal belum tersedia. Jangan mengisi tabel hasil dengan angka perkiraan.

Kondisi repositori dan mesin yang terverifikasi:

| Komponen | Kondisi |
|---|---|
| REST katalog | Handler `GET /api/v1/catalog/products/:id` tersedia di backend pada port bawaan `3000`; memerlukan MySQL yang aktif dan data produk valid. |
| gRPC katalog | `proto/catalog/catalog.proto` mendeklarasikan `CatalogService.GetProductsByIds`, tetapi implementasi server dan proses yang membuka port gRPC belum tersedia. `go_package` pada file proto juga masih placeholder. |
| Go | Runtime terpasang `go1.25.1 windows/amd64`; `backend/go.mod` meminta Go `1.26.4`. Versi runtime dan modul belum cocok. |
| Alat benchmark | `k6` dan `ghz` belum terpasang. Docker CLI ada, tetapi Docker Engine tidak berjalan saat pemeriksaan. |
| Mesin pengujian | Windows 11 Home Single Language, 12 logical CPU, RAM terlihat oleh OS 15.23 GiB. |

Dengan demikian, spesifikasi mesin di atas adalah spesifikasi host yang diperiksa, bukan bukti bahwa pengujian layanan berhasil dijalankan. Catat versi aktual alat dan runtime saat eksekusi, karena dapat berbeda dari tabel ini.

## Tujuan dan pasangan endpoint

Bandingkan komunikasi untuk mengambil satu produk katalog:

| Skenario A — REST | Skenario B — gRPC |
|---|---|
| HTTP/1.1, JSON | HTTP/2, Protocol Buffers |
| `GET /api/v1/catalog/products/{product_id}` | `catalog.v1.CatalogService/GetProductsByIds` dengan satu `product_id` |
| Backend REST pada `127.0.0.1:3000` | Server gRPC (port yang ditetapkan saat implementasi, contoh `50051`) |

Pasangan ini baru dapat dianggap **setara secara fungsional** setelah server gRPC benar-benar diimplementasikan dan respons kedua endpoint berisi data serta operasi yang sama. Saat ini REST mengembalikan produk beserta varian dan gambar, sedangkan pesan protobuf mendefinisikan daftar produk dan `not_found_ids`. Perbedaan isi respons dapat memengaruhi ukuran payload dan waktu pemrosesan; selesaikan atau nyatakan perbedaan ini sebelum menarik kesimpulan komparatif.

Gunakan database, seed, konfigurasi, dan data produk yang sama. Pilih satu ID produk valid yang dipublikasikan, lalu gunakan ID itu pada seluruh skenario. Jangan menjalankan satu protokol dengan cache hangat dan yang lain dengan cache dingin.

## Lingkungan dan kontrol pengujian

Catat sebelum setiap sesi:

- Hostname mesin server dan load generator; simpan hostname asli dalam bukti yang diserahkan.
- CPU fisik/logis, RAM, edisi dan versi OS.
- Versi Go (`go version`), versi backend/commit, versi database, serta konfigurasi pool koneksi.
- Versi `k6`, `ghz`, dan Docker bila dipakai.
- Port, alamat endpoint, ID produk uji, ukuran dataset, serta status health check.
- Apakah klien dan server berjalan pada mesin yang sama. Untuk pengukuran CPU server, lebih baik jalankan load generator pada mesin terpisah; bila satu host, catat bahwa CPU klien turut membebani hasil.

Jalankan kedua protokol pada host/server dan basis data yang sama. Pastikan health check dan permintaan tunggal berhasil sebelum uji. Lakukan satu putaran pemanasan yang tidak dicatat, lalu jalankan skenario REST dan gRPC bergantian. Ulangi setiap skenario minimal tiga kali dan laporkan median dari hasil run, serta sebaran hasil antar-run. Jangan menggabungkan waktu startup atau pemanasan ke durasi terukur.

### Beban wajib

| Skenario | Konkuren | Durasi | Ulangan |
|---|---:|---:|---:|
| 1 — Rendah/sedang | 50 koneksi/VU | 30 detik | Minimal 3 run per protokol |
| 2 — Tinggi/stress | 200 koneksi/VU | 60 detik | Minimal 3 run per protokol |

Konkurensi berarti jumlah permintaan simultan yang dipertahankan alat selama run, bukan total permintaan. Gunakan konfigurasi koneksi yang konsisten sejauh kemampuan masing-masing alat memungkinkan dan laporkan bahwa `ghz` dan alat HTTP mempunyai model koneksi berbeda.

## Alat dan contoh perintah

Gunakan `autocannon` untuk HTTP dan `ghz` untuk gRPC. Pasang dan catat versi alat terlebih dahulu. Contoh berikut hanya bisa dijalankan setelah layanan REST, implementasi gRPC, database, dan data uji tersedia.

```powershell
# REST: beban rendah/sedang
npx autocannon -c 50 -d 30 http://127.0.0.1:3000/api/v1/catalog/products/PRODUCT_ID

# REST: beban tinggi/stress
npx autocannon -c 200 -d 60 http://127.0.0.1:3000/api/v1/catalog/products/PRODUCT_ID

# gRPC: beban rendah/sedang
ghz --insecure `
  --proto .\proto\catalog\catalog.proto `
  --call catalog.v1.CatalogService.GetProductsByIds `
  --data '{"product_ids":["PRODUCT_ID"]}' `
  --concurrency 50 --duration 30s 127.0.0.1:50051

# gRPC: beban tinggi/stress
ghz --insecure `
  --proto .\proto\catalog\catalog.proto `
  --call catalog.v1.CatalogService.GetProductsByIds `
  --data '{"product_ids":["PRODUCT_ID"]}' `
  --concurrency 200 --duration 60s 127.0.0.1:50051
```

Ganti `PRODUCT_ID` dengan ID valid (tanpa tanda kurung siku). Opsi `--insecure` hanya sesuai untuk server lokal tanpa TLS; jangan gunakan untuk endpoint produksi. Simpan output terminal penuh tiap run dan catat hostname, protokol, skenario, serta waktu eksekusi.

## Definisi metrik

- **Rata-rata ukuran payload respons (bytes):** rata-rata byte body respons aplikasi yang diterima klien, tanpa mencampurkan header HTTP/2/HTTP/1.1, TLS, atau framing transport. Ukur payload JSON dan pesan protobuf yang telah diserialisasi menggunakan definisi yang sama. Laporkan juga apakah wrapper/envelope aplikasi termasuk dalam pengukuran.
- **Mean latency, p95, p99:** latency per permintaan dari alat uji; sajikan dalam milidetik. Pakai definisi latency dan agregasi yang konsisten untuk tiap alat.
- **Throughput (req/s):** jumlah permintaan berhasil dibagi durasi pengukuran; laporkan kegagalan secara terpisah. Jangan menyebut nilai maksimum sesaat sebagai throughput rata-rata run.
- **CPU server (%):** rata-rata pemakaian CPU proses/server selama interval uji. Windows dapat melaporkan `% Processor Time` proses lebih dari 100% untuk proses multi-core; normalisasikan terhadap 12 logical CPU (`nilai proses / 12`) agar menjadi persentase kapasitas mesin 0–100%, dan catat metode sampling. Jangan memakai penggunaan CPU keseluruhan mesin sebagai CPU server tanpa menyatakannya.

Metrik payload memerlukan pencatatan byte respons oleh klien atau instrumentasi yang konsisten di kedua protokol; jangan menyamakan `Content-Length` HTTP dengan ukuran pesan protobuf tanpa menyepakati apakah framing termasuk. Catat juga jumlah error dan status/kode respons agar throughput sukses tidak menutupi kegagalan.

## Tabel komparasi hasil

Isi hanya setelah semua prasyarat terpenuhi. Sajikan hasil skenario 50/30 dan 200/60 secara terpisah; gunakan median minimal tiga run dan tambahkan simpangan/min–maks bila tersedia.

| Skenario | Parameter kinerja | REST (HTTP/1.1 + JSON) | gRPC (HTTP/2 + Protobuf) | Selisih / peningkatan |
|---|---|---:|---:|---:|
| 50 konkuren, 30 detik | Rata-rata ukuran payload respons (bytes) | Belum diukur | Belum diukur | Belum dihitung |
| 50 konkuren, 30 detik | Latensi rata-rata (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 50 konkuren, 30 detik | Latensi p95 (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 50 konkuren, 30 detik | Latensi p99 (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 50 konkuren, 30 detik | Throughput sukses (req/s) | Belum diukur | Belum diukur | Belum dihitung |
| 50 konkuren, 30 detik | CPU server rata-rata (%) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | Rata-rata ukuran payload respons (bytes) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | Latensi rata-rata (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | Latensi p95 (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | Latensi p99 (ms) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | Throughput sukses (req/s) | Belum diukur | Belum diukur | Belum dihitung |
| 200 konkuren, 60 detik | CPU server rata-rata (%) | Belum diukur | Belum diukur | Belum dihitung |

Laporkan jumlah permintaan gagal di bawah tabel:

| Skenario | REST — gagal/total | gRPC — gagal/total |
|---|---:|---:|
| 50 konkuren, 30 detik | Belum diukur | Belum diukur |
| 200 konkuren, 60 detik | Belum diukur | Belum diukur |

Gunakan rumus berikut untuk mengisi kolom selisih:

- Payload lebih ringkas (%) = `(REST_bytes - gRPC_bytes) / REST_bytes × 100`.
- Latensi lebih cepat (%) = `(REST_latency - gRPC_latency) / REST_latency × 100`. Nilai negatif berarti gRPC lebih lambat.
- Throughput lebih tinggi (%) = `(gRPC_RPS - REST_RPS) / REST_RPS × 100`.
- CPU: laporkan selisih dalam **poin persentase** (`gRPC_CPU - REST_CPU`); bila membahas perubahan relatif, beri label yang jelas.

## Analisis dan bukti otentik

Analisis akhir harus merujuk pada angka yang benar-benar tercatat. Bahas perubahan p95/p99 dan error pada beban tinggi, bukan hanya mean latency atau throughput puncak. Jelaskan apakah perbedaan payload berasal dari encoding atau bentuk respons yang tidak setara, serta dampak database, cache, jaringan, dan batas CPU. Jangan menyimpulkan bahwa satu protokol selalu lebih cepat hanya dari satu run atau satu metrik.

Lampirkan tangkapan layar terminal yang menampilkan hostname mesin serta ringkasan metrik dari alat uji untuk masing-masing protokol dan skenario. Simpan log mentah bersama catatan versi alat/runtime dan waktu run agar tabel dapat ditelusuri. Saat ini belum ada tangkapan layar atau log benchmark karena layanan gRPC dan prasyarat eksekusi belum tersedia.

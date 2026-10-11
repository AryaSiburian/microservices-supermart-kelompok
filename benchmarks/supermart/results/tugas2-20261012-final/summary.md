# Hasil benchmark Supermart

Hostname: `tayama`. Run: `tugas2-20261012-final`.

Data diukur langsung; latensi mencakup perjalanan jaringan dan decoding klien. Throughput = permintaan sukses / durasi aktual.

| Workers | Protokol | Durasi s | Mean ms | p50 ms | p95 ms | p99 ms | RPS sukses | Payload bytes | CPU host % | Memory MiB | Error |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 50 | REST | 30.002 | 2.702 | 2.350 | 5.611 | 7.774 | 18502.99 | 145 | 33.708 | 14.78 | 0 |
| 50 | GRPC | 30.002 | 2.599 | 2.449 | 4.317 | 5.548 | 19237.73 | 80 | 33.600 | 13.59 | 0 |
| 200 | REST | 60.008 | 10.006 | 7.533 | 26.480 | 39.687 | 19986.10 | 145 | 32.166 | 24.03 | 0 |
| 200 | GRPC | 60.009 | 9.058 | 7.235 | 21.901 | 32.234 | 22077.72 | 80 | 33.269 | 17.15 | 0 |

Persentase perubahan dihitung terhadap REST; positif pada pengurangan latensi/payload berarti gRPC lebih kecil/cepat.

| Workers | Payload lebih kecil % | Mean lebih cepat % | p50 lebih cepat % | p95 lebih cepat % | p99 lebih cepat % | RPS lebih tinggi % |
|---:|---:|---:|---:|---:|---:|---:|
| 50 | 44.83 | 3.82 | -4.19 | 23.07 | 28.64 | 3.97 |
| 200 | 44.83 | 9.47 | 3.96 | 17.29 | 18.78 | 10.47 |

Batas interpretasi: satu putaran per skenario pada satu host dengan klien, provider, database, dan workload lain berbagi sumber daya. CPU/memori adalah seluruh proses provider Inventory, bukan database/klien. CPU host dinormalisasi terhadap jumlah logical CPU. Ukuran payload tidak mengukur seluruh byte jaringan. Tidak ada TLS, kompresi payload, simulasi WAN, atau klaim bahwa gRPC selalu lebih cepat. Memory dapat terbawa dari run sebelumnya karena allocator Go. Ulangi beberapa putaran untuk menilai variasi.

Log asli memuat hostname dan metrik. Screenshot terminal harus diambil sendiri; tidak dibuat dari angka simulasi.

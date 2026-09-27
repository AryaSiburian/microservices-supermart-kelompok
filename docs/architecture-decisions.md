# Keputusan arsitektur database per layanan

## Batas kepemilikan data

Setiap layanan memiliki database, kredensial, port host, dan Docker volume sendiri. Tabel pada satu database hanya boleh menyimpan ID string/UUID untuk merujuk entitas milik layanan lain; tidak ada foreign key lintas database. Pertukaran data antarlayanan nantinya dilakukan melalui API atau event.

## Identity

Identity menggunakan PostgreSQL 15 karena data pengguna, peran, dan izin memiliki relasi yang terstruktur serta memerlukan konsistensi saat perubahan hak akses. Database `identity_service_db` hanya dimiliki Identity Service, menggunakan volume `identity_db_data`, dan diekspos di port host `5431`.

## Catalog

Catalog menggunakan PostgreSQL 15 karena produk, kategori, merek, dan varian dalam seed project memiliki relasi yang jelas. PostgreSQL juga mendukung `jsonb` apabila atribut produk perlu fleksibel. Database `catalog_service_db` hanya dimiliki Catalog Service, menggunakan volume `catalog_db_data`, dan diekspos di port host `5432`.

## Inventory

Inventory menggunakan MySQL 8.0 karena pencatatan stok, reservasi, mutasi antar-gudang, dan audit jumlah barang memerlukan transaksi dan integritas relasional yang kuat. Stok harus konsisten saat beberapa permintaan memesan produk yang sama. MySQL dengan InnoDB cocok untuk transaksi tersebut, sementara pilihan berbeda dari Identity dan Catalog menunjukkan bahwa setiap layanan boleh menentukan DBMS sendiri.

Database `inventory_service_db` memakai kredensial `inventory_admin`, volume `inventory_db_data`, dan port host `3308` yang berbeda dari layanan lain. Skema awal mencakup gudang, batch, stok, mutasi, dan reservasi. Foreign key hanya menghubungkan tabel milik Inventory, misalnya stok ke gudang. `product_id` dari Catalog dan `reference_order_id` dari Order disimpan sebagai ID referensi tanpa foreign key lintas database.

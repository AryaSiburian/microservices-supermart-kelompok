-- =============================================================================
-- DATA SEEDING: PT NUSANTARA SUPERMART INDONESIA
-- BASIS DATA: nusantara_db (MySQL 8.0+)
-- Expanded Seed for Monolith Course Project
-- Password for all accounts: password123
-- =============================================================================

USE `nusantara_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- -----------------------------------------------------------------------------
-- 1. IDENTITAS & PENGGUNA (Roles, Permissions, Users, Profiles, Addresses, KYC)
-- -----------------------------------------------------------------------------
INSERT INTO `roles` (`id`, `role_name`, `description`) VALUES
('r0000001-0000-0000-0000-000000000001', 'SUPER_ADMIN', 'Akses penuh ke seluruh sistem operasional'),
('r0000001-0000-0000-0000-000000000002', 'WAREHOUSE_STAFF', 'Operator stok dan pemrosesan barang di gudang'),
('r0000001-0000-0000-0000-000000000003', 'CUSTOMER', 'Pelanggan retail umum'),
('r0000001-0000-0000-0000-000000000004', 'COURIER', 'Pengemudi logistik dan kurir pengiriman'),
('r0000001-0000-0000-0000-000000000005', 'CS_AGENT', 'Layanan pelanggan dan resolusi tiket kendala');

INSERT INTO `permissions` (`id`, `permission_key`, `description`) VALUES
('pm000001-0000-0000-0000-000000000001', 'users.manage', 'Kelola data pengguna dan perizinan'),
('pm000001-0000-0000-0000-000000000002', 'catalog.manage', 'Kelola produk, kategori, dan brand'),
('pm000001-0000-0000-0000-000000000003', 'inventory.manage', 'Kelola stok dan mutasi gudang'),
('pm000001-0000-0000-0000-000000000004', 'orders.manage', 'Kelola dan perbarui status pesanan'),
('pm000001-0000-0000-0000-000000000005', 'payments.manage', 'Kelola tagihan, faktur, dan verifikasi refund'),
('pm000001-0000-0000-0000-000000000006', 'promotions.manage', 'Kelola program promosi, diskon, dan voucher'),
('pm000001-0000-0000-0000-000000000007', 'logistics.manage', 'Kelola armada pengiriman, kurir, dan rute'),
('pm000001-0000-0000-0000-000000000008', 'procurement.manage', 'Kelola purchase order pemasok dan penerimaan GRN'),
('pm000001-0000-0000-0000-000000000009', 'support.manage', 'Tangani tiket keluhan pelanggan dan FAQ');

INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000001'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000002'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000003'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000004'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000005'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000006'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000007'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000008'),
('r0000001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000009'),
('r0000001-0000-0000-0000-000000000002', 'pm000001-0000-0000-0000-000000000003'),
('r0000001-0000-0000-0000-000000000002', 'pm000001-0000-0000-0000-000000000008'),
('r0000001-0000-0000-0000-000000000004', 'pm000001-0000-0000-0000-000000000007'),
('r0000001-0000-0000-0000-000000000005', 'pm000001-0000-0000-0000-000000000009');

-- Semua password: password123 (bcrypt cost 10: $2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC)
INSERT INTO `users` (`id`, `email`, `password_hash`, `full_name`, `phone_number`, `is_active`) VALUES
('u0000001-0000-0000-0000-000000000001', 'admin@nusantara.co.id', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Budi Hartono (Admin)', '081122334455', 1),
('u0000001-0000-0000-0000-000000000002', 'gudang.jakarta@nusantara.co.id', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Siti Rahma (Staff Gudang JKT)', '081299887766', 1),
('u0000001-0000-0000-0000-000000000003', 'wayan.putra@gmail.com', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'I Wayan Putra Adnyana', '081338001122', 1),
('u0000001-0000-0000-0000-000000000004', 'dewi.lestari@yahoo.com', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Ni Made Dewi Lestari', '081999112233', 1),
('u0000001-0000-0000-0000-000000000005', 'gudang.denpasar@nusantara.co.id', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Made Suartana (Staff Gudang DPS)', '081338776655', 1),
('u0000001-0000-0000-0000-000000000006', 'kurir.anto@nusantara.co.id', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Anto Pratama (Kurir Express)', '081888223344', 1),
('u0000001-0000-0000-0000-000000000007', 'cs.agent@nusantara.co.id', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Rini Indah (CS Support Specialist)', '081777334455', 1),
('u0000001-0000-0000-0000-000000000008', 'budi.santoso@gmail.com', '$2a$10$UwQm.bwc/69L3mHOIx89VOgaeQhi9cJQvtTm.Y5/AbW2P7NRqgfBC', 'Budi Santoso (Customer)', '081234567890', 1);

INSERT INTO `user_roles` (`user_id`, `role_id`) VALUES
('u0000001-0000-0000-0000-000000000001', 'r0000001-0000-0000-0000-000000000001'),
('u0000001-0000-0000-0000-000000000002', 'r0000001-0000-0000-0000-000000000002'),
('u0000001-0000-0000-0000-000000000003', 'r0000001-0000-0000-0000-000000000003'),
('u0000001-0000-0000-0000-000000000004', 'r0000001-0000-0000-0000-000000000003'),
('u0000001-0000-0000-0000-000000000005', 'r0000001-0000-0000-0000-000000000002'),
('u0000001-0000-0000-0000-000000000006', 'r0000001-0000-0000-0000-000000000004'),
('u0000001-0000-0000-0000-000000000007', 'r0000001-0000-0000-0000-000000000005'),
('u0000001-0000-0000-0000-000000000008', 'r0000001-0000-0000-0000-000000000003');

INSERT INTO `user_profiles` (`id`, `user_id`, `gender`, `birth_date`, `avatar_url`, `bio`) VALUES
('prof0001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000001', 'MALE', '1985-05-12', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200', 'Super Administrator Sistem PT Nusantara SuperMart'),
('prof0001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000002', 'FEMALE', '1992-08-20', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200', 'Warehouse Lead Cengkareng DC'),
('prof0001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000003', 'MALE', '1995-11-04', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200', 'Loyal SuperMart member from Denpasar'),
('prof0001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000004', 'FEMALE', '1998-03-15', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200', 'Tech enthusiast and coffee lover from Jakarta');

INSERT INTO `user_addresses` (`id`, `user_id`, `address_label`, `recipient_name`, `phone_number`, `street_address`, `city`, `province`, `postal_code`, `latitude`, `longitude`, `is_primary`) VALUES
('a0000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'Rumah Denpasar', 'Wayan Putra', '081338001122', 'Jl. Hayam Wuruk No. 88, Tanjung Bungkak', 'Denpasar', 'Bali', '80239', -8.6539, 115.2341, 1),
('a0000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000003', 'Kantor Renon', 'Wayan Putra (Office)', '081338001122', 'Jl. Raya Puputan No. 12, Renon', 'Denpasar', 'Bali', '80234', -8.6705, 115.2335, 0),
('a0000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000004', 'Apartemen Sudirman', 'Dewi Lestari', '081999112233', 'Jl. Jend. Sudirman Kav. 45, Tower A Lt. 12', 'Jakarta Selatan', 'DKI Jakarta', '12190', -6.2154, 106.8185, 1),
('a0000001-0000-0000-0000-000000000004', 'u0000001-0000-0000-0000-000000000008', 'Rumah Bandung', 'Budi Santoso', '081234567890', 'Jl. Dago No. 150, Coblong', 'Bandung', 'Jawa Barat', '40135', -6.8856, 107.6133, 1);

INSERT INTO `user_kyc_documents` (`id`, `user_id`, `id_card_number`, `id_card_image_url`, `selfie_image_url`, `verification_status`, `verified_at`) VALUES
('kyc00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', '5171010411950001', 'https://cdn.nusantara.com/kyc/ktp_wayan.jpg', 'https://cdn.nusantara.com/kyc/selfie_wayan.jpg', 'VERIFIED', '2026-08-15 10:00:00'),
('kyc00001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', '3174025503980002', 'https://cdn.nusantara.com/kyc/ktp_dewi.jpg', 'https://cdn.nusantara.com/kyc/selfie_dewi.jpg', 'VERIFIED', '2026-08-20 14:30:00');

-- -----------------------------------------------------------------------------
-- 2. KATALOG PRODUK (Brands, Categories, Hierarchies, Products, Variants, etc)
-- -----------------------------------------------------------------------------
INSERT INTO `brands` (`id`, `brand_name`, `logo_url`, `website_url`) VALUES
('b0000001-0000-0000-0000-000000000001', 'Indofood Agro', 'https://cdn.nusantara.com/brands/indofood.png', 'https://indofood.com'),
('b0000001-0000-0000-0000-000000000002', 'Kintamani Coffee Roastery', 'https://cdn.nusantara.com/brands/kintamani.png', 'https://kintamanicoffee.id'),
('b0000001-0000-0000-0000-000000000003', 'Logitech Indonesia', 'https://cdn.nusantara.com/brands/logitech.png', 'https://logitech.com'),
('b0000001-0000-0000-0000-000000000004', 'Nutrilon Royal', 'https://cdn.nusantara.com/brands/nutrilon.png', 'https://nutriclub.co.id'),
('b0000001-0000-0000-0000-000000000005', 'Unilever Fresh Mart', 'https://cdn.nusantara.com/brands/unilever.png', 'https://unilever.co.id'),
('b0000001-0000-0000-0000-000000000006', 'Samsung Electronics ID', 'https://cdn.nusantara.com/brands/samsung.png', 'https://samsung.com/id');

INSERT INTO `categories` (`id`, `category_name`, `slug`, `icon_url`) VALUES
('c0000001-0000-0000-0000-000000000001', 'Bahan Pokok & Sembako', 'bahan-pokok-sembako', 'https://cdn.nusantara.com/cat/sembako.png'),
('c0000001-0000-0000-0000-000000000002', 'Kopi & Minuman Organik', 'kopi-minuman-organik', 'https://cdn.nusantara.com/cat/beverage.png'),
('c0000001-0000-0000-0000-000000000003', 'Aksesoris Komputer & Gadget', 'aksesoris-komputer', 'https://cdn.nusantara.com/cat/computer.png'),
('c0000001-0000-0000-0000-000000000004', 'Ibu & Bayi', 'ibu-dan-bayi', 'https://cdn.nusantara.com/cat/baby.png'),
('c0000001-0000-0000-0000-000000000005', 'Perawatan Rumah & Dapur', 'perawatan-rumah', 'https://cdn.nusantara.com/cat/home.png'),
('c0000001-0000-0000-0000-000000000006', 'Elektronik & Smart Home', 'elektronik-smart-home', 'https://cdn.nusantara.com/cat/electronics.png'),
('c0000001-0000-0000-0000-000000000007', 'Beras & Padi Pilihan', 'beras-dan-padi', 'https://cdn.nusantara.com/cat/rice.png'),
('c0000001-0000-0000-0000-000000000008', 'Kopi Spesialti Nusantara', 'kopi-spesialti', 'https://cdn.nusantara.com/cat/coffee.png');

INSERT INTO `category_hierarchies` (`parent_category_id`, `child_category_id`, `depth_level`) VALUES
('c0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000007', 1),
('c0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000008', 1);

INSERT INTO `products` (`id`, `sku`, `title`, `description`, `base_price`, `brand_id`, `weight_gram`, `is_published`) VALUES
('p0000001-0000-0000-0000-000000000001', 'SEM-BMS-005', 'Beras Merah Organik Tabanan 5 Kg', 'Beras merah kualitas premium asli Tabanan Bali, kaya serat dan indeks glikemik rendah.', 95000.00, 'b0000001-0000-0000-0000-000000000001', 5000, 1),
('p0000001-0000-0000-0000-000000000002', 'BEV-KNT-250', 'Biji Kopi Arabika Kintamani Honey Process 250g', 'Single origin Kintamani roast medium-to-dark dengan tasting notes citrus dan caramel.', 68000.00, 'b0000001-0000-0000-0000-000000000002', 250, 1),
('p0000001-0000-0000-0000-000000000003', 'ACC-LOG-M22', 'Logitech M220 Silent Wireless Mouse', 'Mouse nirkabel hening 2.4 GHz dengan baterai tahan hingga 18 bulan.', 179000.00, 'b0000001-0000-0000-0000-000000000003', 150, 1),
('p0000001-0000-0000-0000-000000000004', 'ACC-LOG-K38', 'Logitech K380 Multi-Device Bluetooth Keyboard', 'Keyboard bluetooth minimalis untuk Windows, Mac, Chrome OS, Android, dan iOS.', 459000.00, 'b0000001-0000-0000-0000-000000000003', 420, 1),
('p0000001-0000-0000-0000-000000000005', 'SEM-MNG-002', 'Minyak Goreng Sawit Murni 2 Liter', 'Minyak kelapa sawit higienis dua kali penyaringan kaya vitamin A & E.', 34000.00, 'b0000001-0000-0000-0000-000000000001', 2000, 1),
('p0000001-0000-0000-0000-000000000006', 'SEM-GLP-001', 'Gula Pasir Tebu Premium 1 Kg', 'Gula pasir kristal putih murni dari tebu pilihan Indonesia.', 17500.00, 'b0000001-0000-0000-0000-000000000001', 1000, 1),
('p0000001-0000-0000-0000-000000000007', 'BEV-KNT-100', 'Bubuk Kopi Kintamani Drip Bag (Isi 10 Sachet)', 'Kopi arabika celup praktis kualitas specialty siap seduh kapan saja.', 55000.00, 'b0000001-0000-0000-0000-000000000002', 120, 1),
('p0000001-0000-0000-0000-000000000008', 'ELC-SAM-A15', 'Samsung Galaxy A15 8/128GB LTE Blue', 'Smartphone layar 6.5 inci FHD+ Super AMOLED 90Hz, kamera 50MP triple.', 2499000.00, 'b0000001-0000-0000-0000-000000000006', 450, 1),
('p0000001-0000-0000-0000-000000000009', 'HOM-RIN-100', 'Rinso Molto Deterjen Cair Japanese Peach 1.8L', 'Deterjen konsentrat anti noda dengan keharuman tahan lama 21 hari.', 42000.00, 'b0000001-0000-0000-0000-000000000005', 1800, 1),
('p0000001-0000-0000-0000-000000000010', 'BAB-NUT-800', 'Nutrilon Royal 3 Vanila Tin 800g', 'Susu pertumbuhan formula Acti-Duobio+ untuk anak usia 1-3 tahun.', 215000.00, 'b0000001-0000-0000-0000-000000000004', 800, 1),
('p0000001-0000-0000-0000-000000000011', 'ACC-LOG-C92', 'Logitech C920 HD Pro Webcam', 'Full HD 1080p webcam dengan dual stereo microphone untuk video conference.', 1150000.00, 'b0000001-0000-0000-0000-000000000003', 300, 1),
('p0000001-0000-0000-0000-000000000012', 'HOM-SUN-750', 'Sunlight Jeruk Nipis 100 Pencuci Piring 750ml', 'Cairan pencuci piring ekstrak jeruk nipis asli membersihkan lemak 10x lebih cepat.', 16000.00, 'b0000001-0000-0000-0000-000000000005', 750, 1);

INSERT INTO `product_categories` (`product_id`, `category_id`) VALUES
('p0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001'),
('p0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000007'),
('p0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000002'),
('p0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000008'),
('p0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000003'),
('p0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000003'),
('p0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000001'),
('p0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000001'),
('p0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002'),
('p0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000006'),
('p0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000005'),
('p0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000004'),
('p0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000003'),
('p0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000005');

INSERT INTO `product_images` (`id`, `product_id`, `image_url`, `is_primary`, `display_order`) VALUES
('img00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500', 1, 1),
('img00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000002', 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500', 1, 1),
('img00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000003', 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=500', 1, 1),
('img00001-0000-0000-0000-000000000004', 'p0000001-0000-0000-0000-000000000004', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500', 1, 1),
('img00001-0000-0000-0000-000000000005', 'p0000001-0000-0000-0000-000000000008', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?w=500', 1, 1);

INSERT INTO `product_variants` (`id`, `product_id`, `variant_sku`, `additional_price`) VALUES
('var00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000003', 'ACC-LOG-M22-BLK', 0.00),
('var00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000003', 'ACC-LOG-M22-RED', 5000.00),
('var00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000004', 'ACC-LOG-K38-OFFW', 15000.00);

INSERT INTO `product_barcodes` (`id`, `product_id`, `barcode_number`, `barcode_type`) VALUES
('bar00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', '8991234567011', 'EAN-13'),
('bar00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000002', '8991234567028', 'EAN-13'),
('bar00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000003', '097855123456', 'UPC-A'),
('bar00001-0000-0000-0000-000000000004', 'p0000001-0000-0000-0000-000000000004', '097855654321', 'UPC-A');

INSERT INTO `product_reviews` (`id`, `product_id`, `user_id`, `rating`, `review_text`) VALUES
('rev00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 5, 'Beras merah wangi dan pulen sekali, cocok untuk program diet sehat keluarga.'),
('rev00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 5, 'Aroma citrus kopi Kintamani terasa sangat khas saat diseduh V60 pagi hari.'),
('rev00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000003', 4, 'Klik mouse benar-benar senyap, nyaman digunakan di kafe.');

-- -----------------------------------------------------------------------------
-- 3. INVENTARIS & GUDANG (Warehouses, Zones, Shelves, Stocks, Mutations, Alerts)
-- -----------------------------------------------------------------------------
INSERT INTO `warehouses` (`id`, `warehouse_code`, `warehouse_name`, `address`, `city`) VALUES
('w0000001-0000-0000-0000-000000000001', 'WH-DPS-01', 'Hub Logistik Denpasar Barat', 'Jl. Mahendradatta No. 99X', 'Denpasar'),
('w0000001-0000-0000-0000-000000000002', 'WH-JKT-01', 'Central Fulfillment Center Cengkareng', 'Kawasan Pergudangan Soewarna Blok C1', 'Jakarta Barat'),
('w0000001-0000-0000-0000-000000000003', 'WH-SBY-01', 'East Java Distribution Hub Rungkut', 'Jl. Rungkut Industri No. 45', 'Surabaya');

INSERT INTO `warehouse_zones` (`id`, `warehouse_id`, `zone_code`, `zone_type`) VALUES
('z0000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000001', 'Z-AMB-DPS', 'Ambient Dry Storage'),
('z0000001-0000-0000-0000-000000000002', 'w0000001-0000-0000-0000-000000000002', 'Z-ELC-JKT', 'Secure Electronics Zone'),
('z0000001-0000-0000-0000-000000000003', 'w0000001-0000-0000-0000-000000000002', 'Z-FMCG-JKT', 'FMCG High Velocity Area'),
('z0000001-0000-0000-0000-000000000004', 'w0000001-0000-0000-0000-000000000003', 'Z-SBY-MAIN', 'General Merchandising');

INSERT INTO `warehouse_shelves` (`id`, `zone_id`, `shelf_code`, `capacity_cubic_meter`) VALUES
('s0000001-0000-0000-0000-000000000001', 'z0000001-0000-0000-0000-000000000001', 'SHELF-DPS-A1', 50.00),
('s0000001-0000-0000-0000-000000000002', 'z0000001-0000-0000-0000-000000000002', 'SHELF-JKT-E1', 30.00),
('s0000001-0000-0000-0000-000000000003', 'z0000001-0000-0000-0000-000000000003', 'SHELF-JKT-F1', 40.00),
('s0000001-0000-0000-0000-000000000004', 'z0000001-0000-0000-0000-000000000004', 'SHELF-SBY-01', 60.00);

INSERT INTO `inventory_batches` (`id`, `batch_number`, `production_date`, `expiration_date`) VALUES
('bat00001-0000-0000-0000-000000000001', 'BATCH-202608-001', '2026-08-01', '2027-08-01'),
('bat00001-0000-0000-0000-000000000002', 'BATCH-202608-002', '2026-08-10', '2027-02-10');

INSERT INTO `inventory_stocks` (`id`, `product_id`, `warehouse_id`, `batch_id`, `quantity_on_hand`, `quantity_reserved`) VALUES
('stk00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000001', 'bat00001-0000-0000-0000-000000000001', 120, 2),
('stk00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000002', 'w0000001-0000-0000-0000-000000000001', 'bat00001-0000-0000-0000-000000000002', 75, 1),
('stk00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000003', 'w0000001-0000-0000-0000-000000000002', NULL, 200, 0),
('stk00001-0000-0000-0000-000000000004', 'p0000001-0000-0000-0000-000000000004', 'w0000001-0000-0000-0000-000000000002', NULL, 45, 1),
('stk00001-0000-0000-0000-000000000005', 'p0000001-0000-0000-0000-000000000005', 'w0000001-0000-0000-0000-000000000002', NULL, 350, 0),
('stk00001-0000-0000-0000-000000000006', 'p0000001-0000-0000-0000-000000000006', 'w0000001-0000-0000-0000-000000000002', NULL, 400, 0),
('stk00001-0000-0000-0000-000000000007', 'p0000001-0000-0000-0000-000000000008', 'w0000001-0000-0000-0000-000000000002', NULL, 18, 0),
('stk00001-0000-0000-0000-000000000008', 'p0000001-0000-0000-0000-000000000010', 'w0000001-0000-0000-0000-000000000003', NULL, 90, 0);

INSERT INTO `stock_mutations` (`id`, `product_id`, `source_warehouse_id`, `destination_warehouse_id`, `quantity`, `mutation_date`) VALUES
('mut00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000003', 25, '2026-08-28 10:15:00');

INSERT INTO `reorder_rules` (`id`, `product_id`, `minimum_threshold`, `recommended_reorder_qty`) VALUES
('rr000001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 30, 100),
('rr000001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000004', 20, 50),
('rr000001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000008', 5, 20);

INSERT INTO `low_stock_alerts` (`id`, `product_id`, `warehouse_id`, `current_stock`, `threshold`, `is_resolved`) VALUES
('lsa00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000008', 'w0000001-0000-0000-0000-000000000002', 4, 5, 0);

INSERT INTO `stock_opnames` (`id`, `warehouse_id`, `opname_number`, `opname_date`, `conducted_by_user_id`) VALUES
('opn00001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000002', 'OPN-202608-JKT', '2026-08-31', 'u0000001-0000-0000-0000-000000000002');

INSERT INTO `stock_opname_items` (`id`, `stock_opname_id`, `product_id`, `system_qty`, `physical_qty`, `discrepancy_qty`) VALUES
('opi00001-0000-0000-0000-000000000001', 'opn00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000003', 200, 200, 0),
('opi00001-0000-0000-0000-000000000002', 'opn00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000004', 46, 45, -1);

-- -----------------------------------------------------------------------------
-- 4. ORDER & KERANJANG (Carts, Order Statuses, Orders, Items, Details, Fulfillments)
-- -----------------------------------------------------------------------------
INSERT INTO `order_statuses` (`id`, `status_code`, `status_name`) VALUES
('os000001-0000-0000-0000-000000000001', 'AWAITING_PAYMENT', 'Menunggu Pembayaran'),
('os000001-0000-0000-0000-000000000002', 'PROCESSING', 'Pembayaran Lunas, Sedang Dikemas'),
('os000001-0000-0000-0000-000000000003', 'SHIPPED', 'Pesanan Telah Diserahkan ke Kurir'),
('os000001-0000-0000-0000-000000000004', 'COMPLETED', 'Pesanan Selesai Diterima'),
('os000001-0000-0000-0000-000000000005', 'CANCELLED', 'Pesanan Dibatalkan');

-- Cart untuk Budi Santoso
INSERT INTO `carts` (`id`, `user_id`) VALUES
('cart0001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000008');

INSERT INTO `cart_items` (`id`, `cart_id`, `product_id`, `quantity`) VALUES
('ci000001-0000-0000-0000-000000000001', 'cart0001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000002', 2),
('ci000001-0000-0000-0000-000000000002', 'cart0001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000005', 1);

-- Skenario 1: Order Selesai (Wayan Putra)
INSERT INTO `orders` (
    `id`, `order_number`, `customer_id`, `shipping_address_id`, `order_status_id`, `warehouse_id`, 
    `total_gross_amount`, `discount_amount`, `tax_amount`, `shipping_fee`, `total_net_amount`, `created_at`
) VALUES (
    'ord00001-0000-0000-0000-000000000001', 'ORD-2026-0901-001', 
    'u0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000001', 
    'os000001-0000-0000-0000-000000000004', 'w0000001-0000-0000-0000-000000000001',
    258000.00, 20000.00, 26180.00, 15000.00, 279180.00, '2026-09-01 09:30:00'
);

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
('oi000001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 2, 95000.00, 190000.00),
('oi000001-0000-0000-0000-000000000002', 'ord00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000002', 1, 68000.00, 68000.00);

INSERT INTO `order_status_histories` (`id`, `order_id`, `order_status_id`, `notes`) VALUES
('osh00001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000001', 'os000001-0000-0000-0000-000000000001', 'Pesanan dibuat pelanggan'),
('osh00001-0000-0000-0000-000000000002', 'ord00001-0000-0000-0000-000000000001', 'os000001-0000-0000-0000-000000000002', 'Pembayaran QRIS lunas diverifikasi'),
('osh00001-0000-0000-0000-000000000003', 'ord00001-0000-0000-0000-000000000001', 'os000001-0000-0000-0000-000000000003', 'Barang dipickup kurir GoSend'),
('osh00001-0000-0000-0000-000000000004', 'ord00001-0000-0000-0000-000000000001', 'os000001-0000-0000-0000-000000000004', 'Pesanan sukses sampai di alamat');

-- Skenario 2: Order Menunggu Pembayaran (Dewi Lestari)
INSERT INTO `orders` (
    `id`, `order_number`, `customer_id`, `shipping_address_id`, `order_status_id`, `warehouse_id`, 
    `total_gross_amount`, `discount_amount`, `tax_amount`, `shipping_fee`, `total_net_amount`, `created_at`
) VALUES (
    'ord00001-0000-0000-0000-000000000002', 'ORD-2026-0902-002', 
    'u0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', 
    'os000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000002',
    459000.00, 50000.00, 44990.00, 22000.00, 475990.00, '2026-09-02 14:15:00'
);

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
('oi000001-0000-0000-0000-000000000003', 'ord00001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000004', 1, 459000.00, 459000.00);

-- Skenario 3: Order Sedang Dikemas (Dewi Lestari)
INSERT INTO `orders` (
    `id`, `order_number`, `customer_id`, `shipping_address_id`, `order_status_id`, `warehouse_id`, 
    `total_gross_amount`, `discount_amount`, `tax_amount`, `shipping_fee`, `total_net_amount`, `created_at`
) VALUES (
    'ord00001-0000-0000-0000-000000000003', 'ORD-2026-0903-003', 
    'u0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000003', 
    'os000001-0000-0000-0000-000000000002', 'w0000001-0000-0000-0000-000000000002',
    179000.00, 0.00, 19690.00, 12000.00, 210690.00, '2026-09-03 10:00:00'
);

INSERT INTO `order_items` (`id`, `order_id`, `product_id`, `quantity`, `unit_price`, `subtotal`) VALUES
('oi000001-0000-0000-0000-000000000004', 'ord00001-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000003', 1, 179000.00, 179000.00);

-- Skenario 4: Order Dibatalkan (Budi Santoso)
INSERT INTO `orders` (
    `id`, `order_number`, `customer_id`, `shipping_address_id`, `order_status_id`, `warehouse_id`, 
    `total_gross_amount`, `discount_amount`, `tax_amount`, `shipping_fee`, `total_net_amount`, `created_at`
) VALUES (
    'ord00001-0000-0000-0000-000000000004', 'ORD-2026-0904-004', 
    'u0000001-0000-0000-0000-000000000008', 'a0000001-0000-0000-0000-000000000004', 
    'os000001-0000-0000-0000-000000000005', 'w0000001-0000-0000-0000-000000000002',
    68000.00, 0.00, 7480.00, 14000.00, 89480.00, '2026-09-04 11:20:00'
);

INSERT INTO `order_cancellations` (`id`, `order_id`, `cancel_reason`, `cancelled_by_user_id`) VALUES
('cnl00001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000004', 'Salah memilih alamat pengiriman, order ulang', 'u0000001-0000-0000-0000-000000000008');

-- Order details
INSERT INTO `order_shipping_details` (`id`, `order_id`, `courier_name`, `tracking_number`, `shipping_cost`) VALUES
('osd00001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000001', 'GoSend Instant', 'GOSEND-DPS-883192', 15000.00),
('osd00001-0000-0000-0000-000000000002', 'ord00001-0000-0000-0000-000000000003', 'JNE Reguler', 'JNE-CGK-990112', 12000.00);

INSERT INTO `order_notes` (`id`, `order_id`, `author_user_id`, `note_content`) VALUES
('not00001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'Tolong titip di pos sekuriti jika rumah kosong.');

-- -----------------------------------------------------------------------------
-- 5. PEMBAYARAN, FAKTUR, REFUND, & WALLET
-- -----------------------------------------------------------------------------
INSERT INTO `payment_gateways` (`id`, `gateway_name`, `api_endpoint`, `is_active`) VALUES
('gw000001-0000-0000-0000-000000000001', 'Midtrans Snap Simulator', 'https://app.sandbox.midtrans.com/snap/v1', 1),
('gw000001-0000-0000-0000-000000000002', 'Xendit Invoice Simulator', 'https://api.xendit.co/v2/invoices', 1);

INSERT INTO `payment_methods` (`id`, `method_code`, `method_name`) VALUES
('pm000001-0000-0000-0000-000000000001', 'QRIS', 'QRIS Dinamis (Gopay/OVO/ShopeePay/BCA)'),
('pm000001-0000-0000-0000-000000000002', 'BCA_VA', 'BCA Virtual Account'),
('pm000001-0000-0000-0000-000000000003', 'MANDIRI_VA', 'Mandiri Virtual Account'),
('pm000001-0000-0000-0000-000000000004', 'STORE_CREDIT', 'Nusantara Store Credit / Dompet');

INSERT INTO `payment_invoices` (`id`, `invoice_number`, `order_id`, `customer_id`, `amount`, `payment_status`, `due_date`, `paid_at`) VALUES
('inv00001-0000-0000-0000-000000000001', 'INV-20260901-001', 'ord00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 279180.00, 'PAID', '2026-09-02 09:30:00', '2026-09-01 09:35:12'),
('inv00001-0000-0000-0000-000000000002', 'INV-20260902-002', 'ord00001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 475990.00, 'UNPAID', '2026-09-03 14:15:00', NULL),
('inv00001-0000-0000-0000-000000000003', 'INV-20260903-003', 'ord00001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000004', 210690.00, 'PAID', '2026-09-04 10:00:00', '2026-09-03 10:05:30');

INSERT INTO `payment_transactions` (`id`, `invoice_id`, `payment_method_id`, `gateway_id`, `transaction_reference`, `amount_paid`, `status`, `transaction_time`) VALUES
('ptx00001-0000-0000-0000-000000000001', 'inv00001-0000-0000-0000-000000000001', 'pm000001-0000-0000-0000-000000000001', 'gw000001-0000-0000-0000-000000000001', 'TRX-QRIS-992817263', 279180.00, 'SUCCESS', '2026-09-01 09:35:12'),
('ptx00001-0000-0000-0000-000000000002', 'inv00001-0000-0000-0000-000000000003', 'pm000001-0000-0000-0000-000000000002', 'gw000001-0000-0000-0000-000000000002', 'TRX-BCA-881928371', 210690.00, 'SUCCESS', '2026-09-03 10:05:30');

INSERT INTO `store_credits` (`id`, `user_id`, `balance`) VALUES
('sc000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 150000.00),
('sc000001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 50000.00),
('sc000001-0000-0000-0000-000000000003', 'u0000001-0000-0000-0000-000000000008', 25000.00);

INSERT INTO `credit_transactions` (`id`, `store_credit_id`, `amount`, `transaction_type`, `description`) VALUES
('ctx00001-0000-0000-0000-000000000001', 'sc000001-0000-0000-0000-000000000001', 150000.00, 'CREDIT', 'Topup saldo dompet retail');

-- -----------------------------------------------------------------------------
-- 6. PROMOSI, DISKON, VOUCHER, & LOYALITAS
-- -----------------------------------------------------------------------------
INSERT INTO `promotions` (`id`, `promo_code`, `promo_name`, `start_date`, `end_date`, `is_active`) VALUES
('pro00001-0000-0000-0000-000000000001', 'SEMBARANG-SEPT', 'Promo Merdeka Belanja Sembako', '2026-09-01 00:00:00', '2026-09-30 23:59:59', 1),
('pro00001-0000-0000-0000-000000000002', 'TECHFEST-2026', 'Festival Perangkat Kerja & Rumah', '2026-09-01 00:00:00', '2026-10-15 23:59:59', 1);

INSERT INTO `promotion_rules` (`id`, `promotion_id`, `min_purchase_amount`, `discount_percentage`, `max_discount_cap`) VALUES
('pr000001-0000-0000-0000-000000000001', 'pro00001-0000-0000-0000-000000000001', 100000.00, 10.00, 25000.00),
('pr000001-0000-0000-0000-000000000002', 'pro00001-0000-0000-0000-000000000002', 300000.00, 15.00, 50000.00);

INSERT INTO `vouchers` (`id`, `voucher_code`, `voucher_value`, `quota_limit`, `quota_used`, `expires_at`) VALUES
('v0000001-0000-0000-0000-000000000001', 'BALISEHAT20', 20000.00, 500, 48, '2027-12-31 23:59:59'),
('v0000001-0000-0000-0000-000000000002', 'TECHFEST50', 50000.00, 100, 12, '2027-12-31 23:59:59'),
('v0000001-0000-0000-0000-000000000003', 'GRATISONGKIR', 15000.00, 1000, 120, '2027-12-31 23:59:59'),
('v0000001-0000-0000-0000-000000000004', 'WELCOME10', 10000.00, 2000, 85, '2027-12-31 23:59:59');

INSERT INTO `voucher_usages` (`id`, `voucher_id`, `user_id`, `order_id`) VALUES
('vu000001-0000-0000-0000-000000000001', 'v0000001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'ord00001-0000-0000-0000-000000000001');

INSERT INTO `loyalty_points` (`id`, `user_id`, `current_points`) VALUES
('loy00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 280),
('loy00001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 520);

INSERT INTO `point_transactions` (`id`, `loyalty_point_id`, `points`, `point_type`, `reference_order_id`) VALUES
('ptx00001-0000-0000-0000-000000000001', 'loy00001-0000-0000-0000-000000000001', 280, 'EARNED', 'ord00001-0000-0000-0000-000000000001');

INSERT INTO `flash_sales` (`id`, `product_id`, `flash_price`, `allocated_stock`, `starts_at`, `ends_at`) VALUES
('fs000001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000003', 149000.00, 30, '2026-09-05 12:00:00', '2026-09-10 18:00:00');

-- -----------------------------------------------------------------------------
-- 7. LOGISTIK & PENGIRIMAN (Couriers, Zones, Rates, Vehicles, Runs, Tracking)
-- -----------------------------------------------------------------------------
INSERT INTO `courier_partners` (`id`, `partner_code`, `partner_name`) VALUES
('cp000001-0000-0000-0000-000000000001', 'JNE', 'Jalur Nugraha Ekakurir (JNE)'),
('cp000001-0000-0000-0000-000000000002', 'GOSEND', 'GoSend Instant Fulfillment'),
('cp000001-0000-0000-0000-000000000003', 'NUSANTARA_INTERNAL', 'Armada Logistik Nusantara Express');

INSERT INTO `courier_services` (`id`, `partner_id`, `service_name`, `estimated_days`) VALUES
('cs000001-0000-0000-0000-000000000001', 'cp000001-0000-0000-0000-000000000001', 'JNE REG', '2-3 Hari'),
('cs000001-0000-0000-0000-000000000002', 'cp000001-0000-0000-0000-000000000002', 'Instant Courier', '3 Jam'),
('cs000001-0000-0000-0000-000000000003', 'cp000001-0000-0000-0000-000000000003', 'Same Day Delivery', '6 Jam');

INSERT INTO `shipping_zones` (`id`, `zone_name`, `postal_code_prefix`) VALUES
('sz000001-0000-0000-0000-000000000001', 'DENPASAR_URBAN', '802'),
('sz000001-0000-0000-0000-000000000002', 'JAKARTA_METRO', '12'),
('sz000001-0000-0000-0000-000000000003', 'BANDUNG_CITY', '40');

INSERT INTO `shipping_rates` (`id`, `courier_service_id`, `origin_zone_id`, `destination_zone_id`, `rate_per_kg`) VALUES
('sr000001-0000-0000-0000-000000000001', 'cs000001-0000-0000-0000-000000000002', 'sz000001-0000-0000-0000-000000000001', 'sz000001-0000-0000-0000-000000000001', 3000.00),
('sr000001-0000-0000-0000-000000000002', 'cs000001-0000-0000-0000-000000000001', 'sz000001-0000-0000-0000-000000000002', 'sz000001-0000-0000-0000-000000000003', 11000.00);

INSERT INTO `vehicle_fleets` (`id`, `vehicle_plate_number`, `vehicle_type`, `capacity_kg`) VALUES
('veh00001-0000-0000-0000-000000000001', 'B 9182 ABC', 'VAN', 800.00),
('veh00001-0000-0000-0000-000000000002', 'DK 4501 XY', 'MOTORCYCLE', 60.00);

INSERT INTO `courier_drivers` (`id`, `driver_name`, `license_number`, `phone_number`, `assigned_vehicle_id`) VALUES
('drv00001-0000-0000-0000-000000000001', 'Anto Pratama', 'SIM-C-88192831', '081888223344', 'veh00001-0000-0000-0000-000000000002');

INSERT INTO `shipping_orders` (`id`, `order_id`, `courier_service_id`, `tracking_number`, `weight_kg`, `current_status`) VALUES
('so000001-0000-0000-0000-000000000001', 'ord00001-0000-0000-0000-000000000001', 'cs000001-0000-0000-0000-000000000002', 'GOSEND-DPS-883192', 5.25, 'DELIVERED'),
('so000001-0000-0000-0000-000000000002', 'ord00001-0000-0000-0000-000000000003', 'cs000001-0000-0000-0000-000000000001', 'JNE-CGK-990112', 0.45, 'MANIFESTED');

INSERT INTO `proof_of_deliveries` (`id`, `shipping_order_id`, `recipient_name`, `photo_proof_url`, `delivered_time`) VALUES
('pod00001-0000-0000-0000-000000000001', 'so000001-0000-0000-0000-000000000001', 'Wayan Putra (Diterima Langsung)', 'https://cdn.nusantara.com/pod/pod_ord001.jpg', '2026-09-01 11:45:00');

INSERT INTO `shipping_tracking_logs` (`id`, `shipping_order_id`, `status_description`, `location`, `log_time`) VALUES
('stl00001-0000-0000-0000-000000000001', 'so000001-0000-0000-0000-000000000001', 'Pesanan diserahkan ke driver GoSend', 'Hub Denpasar Barat', '2026-09-01 10:10:00'),
('stl00001-0000-0000-0000-000000000002', 'so000001-0000-0000-0000-000000000001', 'Driver dalam perjalanan ke alamat tujuan', 'Jl. Raya Puputan', '2026-09-01 10:45:00'),
('stl00001-0000-0000-0000-000000000003', 'so000001-0000-0000-0000-000000000001', 'Paket berhasil diterima oleh Wayan Putra', 'Tanjung Bungkak Denpasar', '2026-09-01 11:45:00');

-- -----------------------------------------------------------------------------
-- 8. PENGADAAN (PROCUREMENT) & PEMASOK
-- -----------------------------------------------------------------------------
INSERT INTO `suppliers` (`id`, `supplier_code`, `company_name`, `tax_identification_number`, `address`) VALUES
('sup00001-0000-0000-0000-000000000001', 'SUP-IDN-001', 'PT Indofood Sukses Makmur Tbk', '01.001.234.5-092.000', 'Sudirman Plaza, Indofood Tower Lt. 27, Jakarta'),
('sup00001-0000-0000-0000-000000000002', 'SUP-BAL-002', 'Koperasi Tani Kopi Kintamani Bali', '02.441.987.1-901.000', 'Jl. Raya Kintamani No. 7, Bangli, Bali'),
('sup00001-0000-0000-0000-000000000003', 'SUP-LOG-003', 'PT Surya Distribusi Elektronik', '03.882.119.4-015.000', 'Kawasan Industri Pulogadung Blok B, Jakarta Timur');

INSERT INTO `supplier_contacts` (`id`, `supplier_id`, `contact_name`, `email`, `phone`) VALUES
('sc000001-0000-0000-0000-000000000001', 'sup00001-0000-0000-0000-000000000001', 'Hendro Wijaya', 'hendro.w@indofood.co.id', '02157958822'),
('sc000001-0000-0000-0000-000000000002', 'sup00001-0000-0000-0000-000000000002', 'I Gusti Rai', 'gusti.rai@kopikintamani.id', '081238990011');

INSERT INTO `purchase_orders` (`id`, `po_number`, `supplier_id`, `warehouse_id`, `po_date`, `total_po_amount`, `status`) VALUES
('po000001-0000-0000-0000-000000000001', 'PO-2026-0801', 'sup00001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000002', '2026-08-15', 7600000.00, 'RECEIVED'),
('po000001-0000-0000-0000-000000000002', 'PO-2026-0901', 'sup00001-0000-0000-0000-000000000002', 'w0000001-0000-0000-0000-000000000001', '2026-09-02', 4500000.00, 'APPROVED');

INSERT INTO `purchase_order_items` (`id`, `purchase_order_id`, `product_id`, `ordered_qty`, `unit_cost`) VALUES
('poi00001-0000-0000-0000-000000000001', 'po000001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 100, 76000.00),
('poi00001-0000-0000-0000-000000000002', 'po000001-0000-0000-0000-000000000002', 'p0000001-0000-0000-0000-000000000002', 90, 50000.00);

INSERT INTO `goods_receipt_notes` (`id`, `grn_number`, `purchase_order_id`, `received_date`) VALUES
('grn00001-0000-0000-0000-000000000001', 'GRN-202608-01', 'po000001-0000-0000-0000-000000000001', '2026-08-20 14:00:00');

INSERT INTO `goods_receipt_items` (`id`, `grn_id`, `product_id`, `received_qty`) VALUES
('gri00001-0000-0000-0000-000000000001', 'grn00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 100);

INSERT INTO `purchase_invoices` (`id`, `invoice_number`, `purchase_order_id`, `invoice_amount`, `due_date`) VALUES
('pi000001-0000-0000-0000-000000000001', 'PINV-IND-2026-99', 'po000001-0000-0000-0000-000000000001', 7600000.00, '2026-09-20');

-- -----------------------------------------------------------------------------
-- 9. LAYANAN PELANGGAN & TIKET KELUHAN (Support Tickets, Messages, FAQ)
-- -----------------------------------------------------------------------------
INSERT INTO `ticket_categories` (`id`, `category_name`) VALUES
('tc000001-0000-0000-0000-000000000001', 'Kendala Pengiriman & Kurir'),
('tc000001-0000-0000-0000-000000000002', 'Masalah Pembayaran & Tagihan'),
('tc000001-0000-0000-0000-000000000003', 'Kualitas Produk & Retur Barang');

INSERT INTO `ticket_sla_configs` (`id`, `category_id`, `max_response_hours`, `max_resolution_hours`) VALUES
('sla00001-0000-0000-0000-000000000001', 'tc000001-0000-0000-0000-000000000001', 2, 24),
('sla00001-0000-0000-0000-000000000002', 'tc000001-0000-0000-0000-000000000002', 1, 12),
('sla00001-0000-0000-0000-000000000003', 'tc000001-0000-0000-0000-000000000003', 4, 48);

INSERT INTO `customer_tickets` (
    `id`, `ticket_code`, `customer_id`, `order_id`, `category_id`, `subject`, `priority`, `status`, `created_at`
) VALUES (
    'tkt00001-0000-0000-0000-000000000001', 'TKT-202609-001', 
    'u0000001-0000-0000-0000-000000000003', 'ord00001-0000-0000-0000-000000000001', 
    'tc000001-0000-0000-0000-000000000001', 'Konfirmasi Penerimaan Paket Beras', 'LOW', 'RESOLVED', '2026-09-01 12:00:00'
), (
    'tkt00001-0000-0000-0000-000000000002', 'TKT-202609-002', 
    'u0000001-0000-0000-0000-000000000004', 'ord00001-0000-0000-0000-000000000002', 
    'tc000001-0000-0000-0000-000000000002', 'Bantuan Cara Pembayaran Virtual Account', 'MEDIUM', 'OPEN', '2026-09-02 15:00:00'
);

INSERT INTO `ticket_messages` (`id`, `ticket_id`, `sender_user_id`, `message_body`, `sent_at`) VALUES
('tkm00001-0000-0000-0000-000000000001', 'tkt00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000003', 'Halo CS, paket sudah diterima rapi. Terima kasih banyak!', '2026-09-01 12:00:00'),
('tkm00001-0000-0000-0000-000000000002', 'tkt00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000007', 'Sama-sama Bapak Wayan! Senang bisa melayani Anda. Sehat selalu!', '2026-09-01 12:15:00'),
('tkm00001-0000-0000-0000-000000000003', 'tkt00001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000004', 'Halo, nomor virtual account BCA saya tidak bisa dicopy, mohon bantuannya.', '2026-09-02 15:00:00');

INSERT INTO `ticket_assignments` (`id`, `ticket_id`, `assigned_agent_id`, `assigned_at`) VALUES
('tas00001-0000-0000-0000-000000000001', 'tkt00001-0000-0000-0000-000000000001', 'u0000001-0000-0000-0000-000000000007', '2026-09-01 12:05:00'),
('tas00001-0000-0000-0000-000000000002', 'tkt00001-0000-0000-0000-000000000002', 'u0000001-0000-0000-0000-000000000007', '2026-09-02 15:05:00');

INSERT INTO `ticket_ratings` (`id`, `ticket_id`, `satisfaction_score`, `feedback`) VALUES
('tr000001-0000-0000-0000-000000000001', 'tkt00001-0000-0000-0000-000000000001', 5, 'Respon CS Rini sangat ramah dan tanggap!');

INSERT INTO `faq_articles` (`id`, `category_id`, `question`, `answer`, `is_published`) VALUES
('faq00001-0000-0000-0000-000000000001', 'tc000001-0000-0000-0000-000000000001', 'Berapa lama estimasi pengiriman instant?', 'Pengiriman instant melalui GoSend tiba dalam 1 hingga 3 jam setelah barang diserahkan ke kurir.', 1),
('faq00001-0000-0000-0000-000000000002', 'tc000001-0000-0000-0000-000000000002', 'Metode pembayaran apa saja yang didukung?', 'Kami mendukung QRIS (Gopay, OVO, ShopeePay), Transfer Virtual Account (BCA, Mandiri), dan Nusantara Store Credit.', 1),
('faq00001-0000-0000-0000-000000000003', 'tc000001-0000-0000-0000-000000000003', 'Bagaimana prosedur retur barang rusak?', 'Laporkan via menu Bantuan & Tiket dalam 1x24 jam sejak barang tiba dengan menyertakan foto unboxing produk.', 1);

SET FOREIGN_KEY_CHECKS = 1;
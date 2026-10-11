-- Fixture khusus lab Tugas 2; bukan pengganti seed bisnis lengkap.
INSERT INTO roles (id, role_name) VALUES ('role-customer', 'CUSTOMER');
INSERT INTO warehouses (id, warehouse_code, warehouse_name, address, city) VALUES
 ('w0000001-0000-0000-0000-000000000001', 'T2-DPS', 'Hub Logistik Denpasar Barat', 'Fixture Tugas 2', 'Denpasar'),
 ('w0000002-0000-0000-0000-000000000002', 'T2-OTHER', 'Gudang Pembanding', 'Fixture Tugas 2', 'Denpasar');
INSERT INTO products (id, sku, title, base_price, weight_gram, is_published) VALUES
 ('p0000001-0000-0000-0000-000000000001', 'T2-BMS-005', 'Beras Merah Organik Tabanan 5 Kg', 95000, 5000, 1),
 ('p0000002-0000-0000-0000-000000000002', 'T2-GUL-001', 'Gula Fixture', 15000, 1000, 1);
INSERT INTO inventory_stocks (id, product_id, warehouse_id, quantity_on_hand, quantity_reserved) VALUES
 ('stk00001-0000-0000-0000-000000000001', 'p0000001-0000-0000-0000-000000000001', 'w0000001-0000-0000-0000-000000000001', 120, 2),
 ('stk00002-0000-0000-0000-000000000002', 'p0000002-0000-0000-0000-000000000002', 'w0000001-0000-0000-0000-000000000001', 2, 0),
 ('stk00003-0000-0000-0000-000000000003', 'p0000001-0000-0000-0000-000000000001', 'w0000002-0000-0000-0000-000000000002', 100, 3);
INSERT INTO order_statuses (id, status_code, status_name) VALUES
 ('status-awaiting', 'AWAITING_PAYMENT', 'Menunggu Pembayaran'), ('status-cancelled', 'CANCELLED', 'Dibatalkan');
INSERT INTO courier_partners (id, partner_code, partner_name) VALUES ('partner-gosend', 'GOSEND', 'GoSend');
INSERT INTO courier_services (id, partner_id, service_name, estimated_days) VALUES
 ('cs000001-0000-0000-0000-000000000002', 'partner-gosend', 'Instant', '1');

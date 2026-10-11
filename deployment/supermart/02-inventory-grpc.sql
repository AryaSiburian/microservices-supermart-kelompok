-- Apply once after db.sql, with the selected Supermart database as default.
-- Old reservations have no stock-row provenance: do not guess their warehouse.
ALTER TABLE stock_reservations
  ADD COLUMN stock_id VARCHAR(36) NULL,
  ADD INDEX idx_reservations_order_status (reference_order_id, status);
ALTER TABLE inventory_stocks
  ADD INDEX idx_stock_lookup (product_id, warehouse_id, id);

-- Serializes retries and compensation for one order, without an Order-domain FK.
CREATE TABLE inventory_reservation_batches (
  reference_order_id VARCHAR(36) PRIMARY KEY,
  warehouse_id VARCHAR(36) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status ENUM('PENDING', 'HOLD', 'RELEASED') NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

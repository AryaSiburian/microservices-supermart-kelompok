-- Apply once to an existing Billing DB before starting the worker.
-- This table and invoice/item writes commit together in one InnoDB transaction.
CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
    payload_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    invoice_id VARCHAR(36) NOT NULL UNIQUE,
    processed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

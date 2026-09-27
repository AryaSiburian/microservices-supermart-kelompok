-- Inventory owns warehouse and stock data. Product and order IDs belong to
-- other services, so they are stored as references without foreign keys.

CREATE TABLE warehouses (
    id CHAR(36) PRIMARY KEY,
    warehouse_code VARCHAR(50) NOT NULL UNIQUE,
    warehouse_name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE inventory_batches (
    id CHAR(36) PRIMARY KEY,
    batch_number VARCHAR(100) NOT NULL UNIQUE,
    production_date DATE,
    expiration_date DATE
) ENGINE=InnoDB;

CREATE TABLE inventory_stocks (
    id CHAR(36) PRIMARY KEY,
    product_id CHAR(36) NOT NULL COMMENT 'Reference to Catalog Service',
    warehouse_id CHAR(36) NOT NULL,
    batch_id CHAR(36),
    quantity_on_hand INT UNSIGNED NOT NULL DEFAULT 0,
    quantity_reserved INT UNSIGNED NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_stocks_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_stocks_batch FOREIGN KEY (batch_id) REFERENCES inventory_batches(id),
    CONSTRAINT chk_reserved_not_overstock CHECK (quantity_reserved <= quantity_on_hand),
    INDEX idx_stocks_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE stock_mutations (
    id CHAR(36) PRIMARY KEY,
    product_id CHAR(36) NOT NULL COMMENT 'Reference to Catalog Service',
    source_warehouse_id CHAR(36) NOT NULL,
    destination_warehouse_id CHAR(36) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    mutation_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_mutations_source FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT fk_mutations_destination FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT chk_mutation_quantity CHECK (quantity > 0),
    INDEX idx_mutations_product (product_id)
) ENGINE=InnoDB;

CREATE TABLE stock_reservations (
    id CHAR(36) PRIMARY KEY,
    product_id CHAR(36) NOT NULL COMMENT 'Reference to Catalog Service',
    reference_order_id CHAR(36) NOT NULL COMMENT 'Reference to Order Service',
    warehouse_id CHAR(36) NOT NULL,
    reserved_quantity INT UNSIGNED NOT NULL,
    status ENUM('HOLD', 'CONFIRMED', 'RELEASED') NOT NULL DEFAULT 'HOLD',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reservations_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
    CONSTRAINT chk_reserved_quantity CHECK (reserved_quantity > 0),
    INDEX idx_reservations_order (reference_order_id)
) ENGINE=InnoDB;

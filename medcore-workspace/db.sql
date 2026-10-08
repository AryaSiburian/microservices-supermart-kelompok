-- =============================================================================
-- SISTEM INFORMASI TERPADU: PT NUSANTARA SUPERMART INDONESIA
-- SKEMA BASIS DATA MONOLITIK LEGASI (120 TABEL) - DIALECT: MYSQL 8.0+
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `nusantara_db` 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE `nusantara_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- =============================================================================
-- KLUSTER 1: IDENTITAS, AKUN, & AKSES PENGGUNA (12 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `users` (
    `id` VARCHAR(36) PRIMARY KEY,
    `email` VARCHAR(255) NOT NULL UNIQUE,
    `password_hash` VARCHAR(255) NOT NULL,
    `full_name` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(30) NULL,
    `is_active` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_profiles` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `gender` ENUM('MALE', 'FEMALE', 'OTHER') NULL,
    `birth_date` DATE NULL,
    `avatar_url` VARCHAR(500) NULL,
    `bio` TEXT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_addresses` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `address_label` VARCHAR(50) NOT NULL, -- misal: Rumah, Kantor
    `recipient_name` VARCHAR(150) NOT NULL,
    `phone_number` VARCHAR(30) NOT NULL,
    `street_address` TEXT NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `province` VARCHAR(100) NOT NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `latitude` DECIMAL(10, 8) NULL,
    `longitude` DECIMAL(11, 8) NULL,
    `is_primary` TINYINT(1) DEFAULT 0,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_kyc_documents` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `id_card_number` VARCHAR(50) NOT NULL,
    `id_card_image_url` VARCHAR(500) NOT NULL,
    `selfie_image_url` VARCHAR(500) NOT NULL,
    `verification_status` ENUM('PENDING', 'VERIFIED', 'REJECTED') DEFAULT 'PENDING',
    `verified_at` DATETIME NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `roles` (
    `id` VARCHAR(36) PRIMARY KEY,
    `role_name` VARCHAR(50) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `permissions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `permission_key` VARCHAR(100) NOT NULL UNIQUE,
    `description` VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `role_permissions` (
    `role_id` VARCHAR(36) NOT NULL,
    `permission_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`role_id`, `permission_id`),
    FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `user_roles` (
    `user_id` VARCHAR(36) NOT NULL,
    `role_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`user_id`, `role_id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `auth_tokens` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `token_value` VARCHAR(500) NOT NULL UNIQUE,
    `token_type` ENUM('ACCESS', 'REFRESH') NOT NULL,
    `expires_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `login_histories` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `ip_address` VARCHAR(45) NOT NULL,
    `user_agent` TEXT NULL,
    `login_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `password_resets` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `reset_token` VARCHAR(255) NOT NULL UNIQUE,
    `is_used` TINYINT(1) DEFAULT 0,
    `expires_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `two_factor_auths` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `secret_key` VARCHAR(255) NOT NULL,
    `is_enabled` TINYINT(1) DEFAULT 0,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 2: KATALOG PRODUK, KATEGORI, & BRAND (16 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `brands` (
    `id` VARCHAR(36) PRIMARY KEY,
    `brand_name` VARCHAR(100) NOT NULL UNIQUE,
    `logo_url` VARCHAR(500) NULL,
    `website_url` VARCHAR(255) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `categories` (
    `id` VARCHAR(36) PRIMARY KEY,
    `category_name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(150) NOT NULL UNIQUE,
    `icon_url` VARCHAR(500) NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `category_hierarchies` (
    `parent_category_id` VARCHAR(36) NOT NULL,
    `child_category_id` VARCHAR(36) NOT NULL,
    `depth_level` INT DEFAULT 1,
    PRIMARY KEY (`parent_category_id`, `child_category_id`),
    FOREIGN KEY (`parent_category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`child_category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `products` (
    `id` VARCHAR(36) PRIMARY KEY,
    `sku` VARCHAR(64) NOT NULL UNIQUE,
    `title` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `base_price` DECIMAL(15,2) NOT NULL,
    `brand_id` VARCHAR(36) NULL,
    `weight_gram` INT NOT NULL DEFAULT 0,
    `is_published` TINYINT(1) DEFAULT 1,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`brand_id`) REFERENCES `brands`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_translations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `language_code` VARCHAR(10) NOT NULL,
    `translated_title` VARCHAR(255) NOT NULL,
    `translated_description` TEXT NULL,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_categories` (
    `product_id` VARCHAR(36) NOT NULL,
    `category_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`product_id`, `category_id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_attributes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `attribute_name` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `attribute_values` (
    `id` VARCHAR(36) PRIMARY KEY,
    `attribute_id` VARCHAR(36) NOT NULL,
    `value_name` VARCHAR(100) NOT NULL,
    FOREIGN KEY (`attribute_id`) REFERENCES `product_attributes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_attribute_values` (
    `product_id` VARCHAR(36) NOT NULL,
    `attribute_value_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`product_id`, `attribute_value_id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_images` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `image_url` VARCHAR(500) NOT NULL,
    `is_primary` TINYINT(1) DEFAULT 0,
    `display_order` INT DEFAULT 0,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_variants` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `variant_sku` VARCHAR(64) NOT NULL UNIQUE,
    `additional_price` DECIMAL(15,2) DEFAULT 0.00,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_variant_options` (
    `variant_id` VARCHAR(36) NOT NULL,
    `attribute_value_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`variant_id`, `attribute_value_id`),
    FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`attribute_value_id`) REFERENCES `attribute_values`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `tags` (
    `id` VARCHAR(36) PRIMARY KEY,
    `tag_name` VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_tags` (
    `product_id` VARCHAR(36) NOT NULL,
    `tag_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`product_id`, `tag_id`),
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_barcodes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `barcode_number` VARCHAR(100) NOT NULL UNIQUE,
    `barcode_type` VARCHAR(30) DEFAULT 'EAN-13',
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `product_reviews` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL, -- Tight coupling ke User
    `rating` TINYINT NOT NULL CHECK (`rating` BETWEEN 1 AND 5),
    `review_text` TEXT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 3: INVENTARIS, GUDANG, & MANAJEMEN STOK (15 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `warehouses` (
    `id` VARCHAR(36) PRIMARY KEY,
    `warehouse_code` VARCHAR(50) NOT NULL UNIQUE,
    `warehouse_name` VARCHAR(150) NOT NULL,
    `address` TEXT NOT NULL,
    `city` VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `warehouse_zones` (
    `id` VARCHAR(36) PRIMARY KEY,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `zone_code` VARCHAR(50) NOT NULL,
    `zone_type` VARCHAR(50) NOT NULL, -- e.g., Ambient, Cold Storage
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `warehouse_shelves` (
    `id` VARCHAR(36) PRIMARY KEY,
    `zone_id` VARCHAR(36) NOT NULL,
    `shelf_code` VARCHAR(50) NOT NULL,
    `capacity_cubic_meter` DECIMAL(8,2) NULL,
    FOREIGN KEY (`zone_id`) REFERENCES `warehouse_zones`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `inventory_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL, -- Tight coupling ke Product
    `shelf_id` VARCHAR(36) NULL,
    `serial_number` VARCHAR(100) NULL,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`shelf_id`) REFERENCES `warehouse_shelves`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `inventory_batches` (
    `id` VARCHAR(36) PRIMARY KEY,
    `batch_number` VARCHAR(100) NOT NULL UNIQUE,
    `production_date` DATE NULL,
    `expiration_date` DATE NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `inventory_stocks` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,   -- Tight coupling ke Product
    `warehouse_id` VARCHAR(36) NOT NULL, -- Tight coupling ke Warehouse
    `batch_id` VARCHAR(36) NULL,
    `quantity_on_hand` INT NOT NULL DEFAULT 0,
    `quantity_reserved` INT NOT NULL DEFAULT 0,
    `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `stock_mutations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `source_warehouse_id` VARCHAR(36) NOT NULL,
    `destination_warehouse_id` VARCHAR(36) NOT NULL,
    `quantity` INT NOT NULL,
    `mutation_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
    FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses`(`id`),
    FOREIGN KEY (`destination_warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `stock_reservations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `reference_order_id` VARCHAR(36) NOT NULL, -- Relasi silang ke Order
    `reserved_quantity` INT NOT NULL,
    `status` ENUM('HOLD', 'CONFIRMED', 'RELEASED') DEFAULT 'HOLD',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `stock_opnames` (
    `id` VARCHAR(36) PRIMARY KEY,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `opname_number` VARCHAR(64) NOT NULL UNIQUE,
    `opname_date` DATE NOT NULL,
    `conducted_by_user_id` VARCHAR(36) NOT NULL,
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`),
    FOREIGN KEY (`conducted_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `stock_opname_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `stock_opname_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `system_qty` INT NOT NULL,
    `physical_qty` INT NOT NULL,
    `discrepancy_qty` INT NOT NULL,
    FOREIGN KEY (`stock_opname_id`) REFERENCES `stock_opnames`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `supplier_returns` (
    `id` VARCHAR(36) PRIMARY KEY,
    `return_number` VARCHAR(64) NOT NULL UNIQUE,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `return_date` DATE NOT NULL,
    `reason` TEXT NULL,
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `supplier_return_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `supplier_return_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `quantity` INT NOT NULL,
    FOREIGN KEY (`supplier_return_id`) REFERENCES `supplier_returns`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `damaged_goods` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `quantity` INT NOT NULL,
    `damage_description` TEXT NOT NULL,
    `reported_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `reorder_rules` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL UNIQUE,
    `minimum_threshold` INT NOT NULL,
    `recommended_reorder_qty` INT NOT NULL,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `low_stock_alerts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `current_stock` INT NOT NULL,
    `threshold` INT NOT NULL,
    `is_resolved` TINYINT(1) DEFAULT 0,
    `alert_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 4: TRANSAKSI PENJUALAN, ORDER, & KERANJANG (18 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `carts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE, -- Tight coupling ke User
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `cart_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `cart_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Tight coupling ke Product
    `quantity` INT NOT NULL DEFAULT 1,
    FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_statuses` (
    `id` VARCHAR(36) PRIMARY KEY,
    `status_code` VARCHAR(32) NOT NULL UNIQUE,
    `status_name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `orders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_number` VARCHAR(64) NOT NULL UNIQUE,
    `customer_id` VARCHAR(36) NOT NULL,         -- Tight coupling ke Users
    `shipping_address_id` VARCHAR(36) NOT NULL, -- Tight coupling ke User Address
    `order_status_id` VARCHAR(36) NOT NULL,
    `warehouse_id` VARCHAR(36) NOT NULL,        -- Tight coupling ke Warehouse
    `total_gross_amount` DECIMAL(15,2) NOT NULL,
    `discount_amount` DECIMAL(15,2) DEFAULT 0.00,
    `tax_amount` DECIMAL(15,2) DEFAULT 0.00,
    `shipping_fee` DECIMAL(15,2) NOT NULL,
    `total_net_amount` DECIMAL(15,2) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`shipping_address_id`) REFERENCES `user_addresses`(`id`),
    FOREIGN KEY (`order_status_id`) REFERENCES `order_statuses`(`id`),
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Tight coupling ke Product
    `quantity` INT NOT NULL,
    `unit_price` DECIMAL(15,2) NOT NULL,
    `subtotal` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_status_histories` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `order_status_id` VARCHAR(36) NOT NULL,
    `notes` TEXT NULL,
    `changed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`order_status_id`) REFERENCES `order_statuses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_cancellations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL UNIQUE,
    `cancelled_by_user_id` VARCHAR(36) NOT NULL,
    `cancel_reason` TEXT NOT NULL,
    `cancelled_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`cancelled_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_discounts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `discount_type` VARCHAR(50) NOT NULL,
    `discount_value` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_tax_details` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `tax_name` VARCHAR(50) NOT NULL,
    `tax_rate_percent` DECIMAL(5,2) NOT NULL,
    `tax_calculated_amount` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_shipping_details` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL UNIQUE,
    `courier_name` VARCHAR(100) NOT NULL,
    `tracking_number` VARCHAR(100) NULL,
    `shipping_cost` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `checkout_sessions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `session_payload` JSON NOT NULL,
    `expires_at` DATETIME NOT NULL,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `sales_quotes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `quote_number` VARCHAR(64) NOT NULL UNIQUE,
    `customer_id` VARCHAR(36) NOT NULL,
    `total_amount` DECIMAL(15,2) NOT NULL,
    `valid_until` DATE NOT NULL,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `sales_quote_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `quote_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `quantity` INT NOT NULL,
    `quoted_price` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`quote_id`) REFERENCES `sales_quotes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `split_orders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `parent_order_id` VARCHAR(36) NOT NULL,
    `child_order_id` VARCHAR(36) NOT NULL,
    `split_reason` VARCHAR(255) NULL,
    FOREIGN KEY (`parent_order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`child_order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `preorders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL UNIQUE,
    `expected_availability_date` DATE NOT NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_notes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `author_user_id` VARCHAR(36) NOT NULL,
    `note_content` TEXT NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`author_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_audit_logs` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL,
    `action_taken` VARCHAR(100) NOT NULL,
    `raw_changes` JSON NULL,
    `timestamp` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `order_item_fulfillments` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_item_id` VARCHAR(36) NOT NULL,
    `fulfilled_quantity` INT NOT NULL,
    `fulfilled_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 5: PEMBAYARAN, FAKTUR, & PENGEMBALIAN DANA (12 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `payment_methods` (
    `id` VARCHAR(36) PRIMARY KEY,
    `method_code` VARCHAR(50) NOT NULL UNIQUE,
    `method_name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_gateways` (
    `id` VARCHAR(36) PRIMARY KEY,
    `gateway_name` VARCHAR(100) NOT NULL,
    `api_endpoint` VARCHAR(255) NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_invoices` (
    `id` VARCHAR(36) PRIMARY KEY,
    `invoice_number` VARCHAR(64) NOT NULL UNIQUE,
    `order_id` VARCHAR(36) NOT NULL,      -- Tight coupling ke Order
    `customer_id` VARCHAR(36) NOT NULL,   -- Tight coupling ke User
    `amount` DECIMAL(15,2) NOT NULL,
    `payment_status` ENUM('UNPAID', 'PAID', 'EXPIRED', 'CANCELLED') DEFAULT 'UNPAID',
    `due_date` DATETIME NOT NULL,
    `paid_at` DATETIME NULL,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_transactions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `invoice_id` VARCHAR(36) NOT NULL,
    `payment_method_id` VARCHAR(36) NOT NULL,
    `gateway_id` VARCHAR(36) NULL,
    `transaction_reference` VARCHAR(100) NOT NULL UNIQUE,
    `amount_paid` DECIMAL(15,2) NOT NULL,
    `status` ENUM('PENDING', 'SUCCESS', 'FAILED') DEFAULT 'PENDING',
    `transaction_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`invoice_id`) REFERENCES `payment_invoices`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods`(`id`),
    FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `payment_callbacks` (
    `id` VARCHAR(36) PRIMARY KEY,
    `gateway_id` VARCHAR(36) NOT NULL,
    `payload` JSON NOT NULL,
    `received_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`gateway_id`) REFERENCES `payment_gateways`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `refunds` (
    `id` VARCHAR(36) PRIMARY KEY,
    `refund_number` VARCHAR(64) NOT NULL UNIQUE,
    `order_id` VARCHAR(36) NOT NULL,
    `requested_by_user_id` VARCHAR(36) NOT NULL,
    `total_refund_amount` DECIMAL(15,2) NOT NULL,
    `refund_status` ENUM('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED') DEFAULT 'PENDING',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`),
    FOREIGN KEY (`requested_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `refund_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `refund_id` VARCHAR(36) NOT NULL,
    `order_item_id` VARCHAR(36) NOT NULL,
    `quantity` INT NOT NULL,
    `refund_subtotal` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`order_item_id`) REFERENCES `order_items`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `refund_transactions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `refund_id` VARCHAR(36) NOT NULL,
    `transaction_reference` VARCHAR(100) NOT NULL,
    `disbursed_amount` DECIMAL(15,2) NOT NULL,
    `disbursed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`refund_id`) REFERENCES `refunds`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `escrow_accounts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL UNIQUE,
    `held_amount` DECIMAL(15,2) NOT NULL,
    `is_released` TINYINT(1) DEFAULT 0,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `store_credits` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `balance` DECIMAL(15,2) DEFAULT 0.00,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `credit_transactions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `store_credit_id` VARCHAR(36) NOT NULL,
    `amount` DECIMAL(15,2) NOT NULL,
    `transaction_type` ENUM('CREDIT', 'DEBIT') NOT NULL,
    `description` VARCHAR(255) NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`store_credit_id`) REFERENCES `store_credits`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `disbursement_ledgers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `disbursement_reference` VARCHAR(64) NOT NULL UNIQUE,
    `amount` DECIMAL(15,2) NOT NULL,
    `recipient_bank_code` VARCHAR(30) NOT NULL,
    `recipient_account_number` VARCHAR(50) NOT NULL,
    `status` ENUM('PENDING', 'PROCESSED', 'FAILED') DEFAULT 'PENDING'
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 6: PROMOSI, DISKON, VOUCHER, & LOYALITAS (14 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `promotions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `promo_code` VARCHAR(50) NOT NULL UNIQUE,
    `promo_name` VARCHAR(150) NOT NULL,
    `start_date` DATETIME NOT NULL,
    `end_date` DATETIME NOT NULL,
    `is_active` TINYINT(1) DEFAULT 1
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `promotion_rules` (
    `id` VARCHAR(36) PRIMARY KEY,
    `promotion_id` VARCHAR(36) NOT NULL,
    `min_purchase_amount` DECIMAL(15,2) DEFAULT 0.00,
    `discount_percentage` DECIMAL(5,2) DEFAULT 0.00,
    `max_discount_cap` DECIMAL(15,2) NULL,
    FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `discount_tiers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `promotion_id` VARCHAR(36) NOT NULL,
    `tier_level` INT NOT NULL,
    `tier_discount_percent` DECIMAL(5,2) NOT NULL,
    FOREIGN KEY (`promotion_id`) REFERENCES `promotions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `vouchers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `voucher_code` VARCHAR(50) NOT NULL UNIQUE,
    `voucher_value` DECIMAL(15,2) NOT NULL,
    `quota_limit` INT NOT NULL DEFAULT 100,
    `quota_used` INT NOT NULL DEFAULT 0,
    `expires_at` DATETIME NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `voucher_usages` (
    `id` VARCHAR(36) PRIMARY KEY,
    `voucher_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,   -- Tight coupling ke User
    `order_id` VARCHAR(36) NOT NULL,  -- Tight coupling ke Order
    `used_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`),
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `voucher_customer_eligibilities` (
    `voucher_id` VARCHAR(36) NOT NULL,
    `user_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`voucher_id`, `user_id`),
    FOREIGN KEY (`voucher_id`) REFERENCES `vouchers`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `coupons` (
    `id` VARCHAR(36) PRIMARY KEY,
    `coupon_serial` VARCHAR(64) NOT NULL UNIQUE,
    `is_redeemed` TINYINT(1) DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `bundle_packages` (
    `id` VARCHAR(36) PRIMARY KEY,
    `package_name` VARCHAR(150) NOT NULL,
    `package_price` DECIMAL(15,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `bundle_items` (
    `bundle_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Coupling ke Product
    `quantity` INT NOT NULL DEFAULT 1,
    PRIMARY KEY (`bundle_id`, `product_id`),
    FOREIGN KEY (`bundle_id`) REFERENCES `bundle_packages`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `loyalty_points` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL UNIQUE,
    `current_points` INT DEFAULT 0,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `point_transactions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `loyalty_point_id` VARCHAR(36) NOT NULL,
    `points` INT NOT NULL,
    `point_type` ENUM('EARNED', 'REDEEMED') NOT NULL,
    `reference_order_id` VARCHAR(36) NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`loyalty_point_id`) REFERENCES `loyalty_points`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `point_redemptions` (
    `id` VARCHAR(36) PRIMARY KEY,
    `user_id` VARCHAR(36) NOT NULL,
    `reward_name` VARCHAR(150) NOT NULL,
    `points_deducted` INT NOT NULL,
    `redeemed_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `cashback_programs` (
    `id` VARCHAR(36) PRIMARY KEY,
    `program_name` VARCHAR(150) NOT NULL,
    `cashback_percentage` DECIMAL(5,2) NOT NULL,
    `max_cashback_amount` DECIMAL(15,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `flash_sales` (
    `id` VARCHAR(36) PRIMARY KEY,
    `product_id` VARCHAR(36) NOT NULL,
    `flash_price` DECIMAL(15,2) NOT NULL,
    `allocated_stock` INT NOT NULL,
    `starts_at` DATETIME NOT NULL,
    `ends_at` DATETIME NOT NULL,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 7: LOGISTIK, PENGIRIMAN, & MANAJEMEN KURIR (13 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `courier_partners` (
    `id` VARCHAR(36) PRIMARY KEY,
    `partner_code` VARCHAR(50) NOT NULL UNIQUE,
    `partner_name` VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `courier_services` (
    `id` VARCHAR(36) PRIMARY KEY,
    `partner_id` VARCHAR(36) NOT NULL,
    `service_name` VARCHAR(100) NOT NULL, -- Reguler, Next Day, Kargo
    `estimated_days` VARCHAR(20) NOT NULL,
    FOREIGN KEY (`partner_id`) REFERENCES `courier_partners`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `shipping_zones` (
    `id` VARCHAR(36) PRIMARY KEY,
    `zone_name` VARCHAR(100) NOT NULL UNIQUE,
    `postal_code_prefix` VARCHAR(10) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `shipping_rates` (
    `id` VARCHAR(36) PRIMARY KEY,
    `courier_service_id` VARCHAR(36) NOT NULL,
    `origin_zone_id` VARCHAR(36) NOT NULL,
    `destination_zone_id` VARCHAR(36) NOT NULL,
    `rate_per_kg` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`courier_service_id`) REFERENCES `courier_services`(`id`),
    FOREIGN KEY (`origin_zone_id`) REFERENCES `shipping_zones`(`id`),
    FOREIGN KEY (`destination_zone_id`) REFERENCES `shipping_zones`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `vehicle_fleets` (
    `id` VARCHAR(36) PRIMARY KEY,
    `vehicle_plate_number` VARCHAR(30) NOT NULL UNIQUE,
    `vehicle_type` ENUM('MOTORCYCLE', 'VAN', 'TRUCK') NOT NULL,
    `capacity_kg` DECIMAL(8,2) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `courier_drivers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `driver_name` VARCHAR(150) NOT NULL,
    `license_number` VARCHAR(50) NOT NULL UNIQUE,
    `phone_number` VARCHAR(30) NOT NULL,
    `assigned_vehicle_id` VARCHAR(36) NULL,
    FOREIGN KEY (`assigned_vehicle_id`) REFERENCES `vehicle_fleets`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `shipping_orders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `order_id` VARCHAR(36) NOT NULL UNIQUE, -- Coupling ke Order
    `courier_service_id` VARCHAR(36) NOT NULL,
    `tracking_number` VARCHAR(100) NOT NULL UNIQUE,
    `weight_kg` DECIMAL(8,2) NOT NULL,
    `current_status` VARCHAR(50) DEFAULT 'MANIFESTED',
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`courier_service_id`) REFERENCES `courier_services`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `shipping_manifests` (
    `id` VARCHAR(36) PRIMARY KEY,
    `manifest_code` VARCHAR(64) NOT NULL UNIQUE,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `delivery_runs` (
    `id` VARCHAR(36) PRIMARY KEY,
    `run_number` VARCHAR(64) NOT NULL UNIQUE,
    `driver_id` VARCHAR(36) NOT NULL,
    `run_date` DATE NOT NULL,
    `status` ENUM('ASSIGNED', 'IN_TRANSIT', 'COMPLETED') DEFAULT 'ASSIGNED',
    FOREIGN KEY (`driver_id`) REFERENCES `courier_drivers`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `delivery_run_orders` (
    `delivery_run_id` VARCHAR(36) NOT NULL,
    `shipping_order_id` VARCHAR(36) NOT NULL,
    PRIMARY KEY (`delivery_run_id`, `shipping_order_id`),
    FOREIGN KEY (`delivery_run_id`) REFERENCES `delivery_runs`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`shipping_order_id`) REFERENCES `shipping_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `proof_of_deliveries` (
    `id` VARCHAR(36) PRIMARY KEY,
    `shipping_order_id` VARCHAR(36) NOT NULL UNIQUE,
    `recipient_name` VARCHAR(150) NOT NULL,
    `signature_image_url` VARCHAR(500) NULL,
    `photo_proof_url` VARCHAR(500) NOT NULL,
    `delivered_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`shipping_order_id`) REFERENCES `shipping_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `shipping_tracking_logs` (
    `id` VARCHAR(36) PRIMARY KEY,
    `shipping_order_id` VARCHAR(36) NOT NULL,
    `status_description` VARCHAR(255) NOT NULL,
    `location` VARCHAR(100) NOT NULL,
    `log_time` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`shipping_order_id`) REFERENCES `shipping_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `customs_declarations` (
    `id` VARCHAR(36) PRIMARY KEY,
    `shipping_order_id` VARCHAR(36) NOT NULL UNIQUE,
    `declared_value` DECIMAL(15,2) NOT NULL,
    `hs_code` VARCHAR(30) NOT NULL,
    FOREIGN KEY (`shipping_order_id`) REFERENCES `shipping_orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 8: PENGADAAN (PROCUREMENT) & PEMASOK (10 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `suppliers` (
    `id` VARCHAR(36) PRIMARY KEY,
    `supplier_code` VARCHAR(50) NOT NULL UNIQUE,
    `company_name` VARCHAR(150) NOT NULL,
    `tax_identification_number` VARCHAR(50) NOT NULL,
    `address` TEXT NOT NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `supplier_contacts` (
    `id` VARCHAR(36) PRIMARY KEY,
    `supplier_id` VARCHAR(36) NOT NULL,
    `contact_name` VARCHAR(150) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(30) NOT NULL,
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `rfq_requests` (
    `id` VARCHAR(36) PRIMARY KEY,
    `rfq_number` VARCHAR(64) NOT NULL UNIQUE,
    `request_date` DATE NOT NULL,
    `status` ENUM('DRAFT', 'SENT', 'CLOSED') DEFAULT 'DRAFT'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `rfq_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `rfq_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Coupling ke Product
    `target_quantity` INT NOT NULL,
    FOREIGN KEY (`rfq_id`) REFERENCES `rfq_requests`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `supplier_price_agreements` (
    `id` VARCHAR(36) PRIMARY KEY,
    `supplier_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Coupling ke Product
    `contract_unit_price` DECIMAL(15,2) NOT NULL,
    `effective_until` DATE NOT NULL,
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `purchase_orders` (
    `id` VARCHAR(36) PRIMARY KEY,
    `po_number` VARCHAR(64) NOT NULL UNIQUE,
    `supplier_id` VARCHAR(36) NOT NULL,
    `warehouse_id` VARCHAR(36) NOT NULL,
    `po_date` DATE NOT NULL,
    `total_po_amount` DECIMAL(15,2) NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'RECEIVED', 'CANCELLED') DEFAULT 'PENDING',
    FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`),
    FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `purchase_order_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL, -- Coupling ke Product
    `ordered_qty` INT NOT NULL,
    `unit_cost` DECIMAL(15,2) NOT NULL,
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `goods_receipt_notes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `grn_number` VARCHAR(64) NOT NULL UNIQUE,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `received_date` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `goods_receipt_items` (
    `id` VARCHAR(36) PRIMARY KEY,
    `grn_id` VARCHAR(36) NOT NULL,
    `product_id` VARCHAR(36) NOT NULL,
    `received_qty` INT NOT NULL,
    FOREIGN KEY (`grn_id`) REFERENCES `goods_receipt_notes`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `purchase_invoices` (
    `id` VARCHAR(36) PRIMARY KEY,
    `invoice_number` VARCHAR(64) NOT NULL UNIQUE,
    `purchase_order_id` VARCHAR(36) NOT NULL,
    `invoice_amount` DECIMAL(15,2) NOT NULL,
    `due_date` DATE NOT NULL,
    FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`)
) ENGINE=InnoDB;

-- =============================================================================
-- KLUSTER 9: LAYANAN PELANGGAN & PENANGANAN KELUHAN (10 TABEL)
-- =============================================================================

CREATE TABLE IF NOT EXISTS `ticket_categories` (
    `id` VARCHAR(36) PRIMARY KEY,
    `category_name` VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ticket_sla_configs` (
    `id` VARCHAR(36) PRIMARY KEY,
    `category_id` VARCHAR(36) NOT NULL,
    `max_response_hours` INT NOT NULL,
    `max_resolution_hours` INT NOT NULL,
    FOREIGN KEY (`category_id`) REFERENCES `ticket_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `customer_tickets` (
    `id` VARCHAR(36) PRIMARY KEY,
    `ticket_code` VARCHAR(64) NOT NULL UNIQUE,
    `customer_id` VARCHAR(36) NOT NULL,      -- Tight coupling ke User
    `order_id` VARCHAR(36) NULL,              -- Tight coupling ke Order
    `category_id` VARCHAR(36) NOT NULL,
    `subject` VARCHAR(255) NOT NULL,
    `priority` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
    `status` ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED') DEFAULT 'OPEN',
    `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE SET NULL,
    FOREIGN KEY (`category_id`) REFERENCES `ticket_categories`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ticket_messages` (
    `id` VARCHAR(36) PRIMARY KEY,
    `ticket_id` VARCHAR(36) NOT NULL,
    `sender_user_id` VARCHAR(36) NOT NULL,
    `message_body` TEXT NOT NULL,
    `sent_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `customer_tickets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`sender_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ticket_attachments` (
    `id` VARCHAR(36) PRIMARY KEY,
    `ticket_message_id` VARCHAR(36) NOT NULL,
    `attachment_url` VARCHAR(500) NOT NULL,
    FOREIGN KEY (`ticket_message_id`) REFERENCES `ticket_messages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ticket_assignments` (
    `id` VARCHAR(36) PRIMARY KEY,
    `ticket_id` VARCHAR(36) NOT NULL,
    `assigned_agent_id` VARCHAR(36) NOT NULL,
    `assigned_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (`ticket_id`) REFERENCES `customer_tickets`(`id`) ON DELETE CASCADE,
    FOREIGN KEY (`assigned_agent_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `ticket_ratings` (
    `id` VARCHAR(36) PRIMARY KEY,
    `ticket_id` VARCHAR(36) NOT NULL UNIQUE,
    `satisfaction_score` TINYINT NOT NULL CHECK (`satisfaction_score` BETWEEN 1 AND 5),
    `feedback` TEXT NULL,
    FOREIGN KEY (`ticket_id`) REFERENCES `customer_tickets`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `disputes` (
    `id` VARCHAR(36) PRIMARY KEY,
    `dispute_number` VARCHAR(64) NOT NULL UNIQUE,
    `order_id` VARCHAR(36) NOT NULL,
    `claim_amount` DECIMAL(15,2) NOT NULL,
    `status` ENUM('OPEN', 'ARBITRATION', 'RESOLVED') DEFAULT 'OPEN',
    FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `dispute_evidences` (
    `id` VARCHAR(36) PRIMARY KEY,
    `dispute_id` VARCHAR(36) NOT NULL,
    `evidence_type` VARCHAR(50) NOT NULL,
    `evidence_url` VARCHAR(500) NOT NULL,
    FOREIGN KEY (`dispute_id`) REFERENCES `disputes`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `faq_articles` (
    `id` VARCHAR(36) PRIMARY KEY,
    `category_id` VARCHAR(36) NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `is_published` TINYINT(1) DEFAULT 1,
    FOREIGN KEY (`category_id`) REFERENCES `ticket_categories`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- =============================================================================
-- RE-AKTIVASI PENGECEKAN KUNCI ASING
-- =============================================================================
SET FOREIGN_KEY_CHECKS = 1;
-- Additional read-only demo records for the module's /products/1 and /orders/1.
-- Uses existing SuperMart product/customer/address/status data. Existing rows
-- are never overwritten, and this runs only when initializing a new DB volume.
USE nusantara_db;

INSERT IGNORE INTO products
    (id,sku,title,description,base_price,brand_id,weight_gram,is_published)
SELECT '1',CONCAT('GW-',sku),title,description,base_price,brand_id,weight_gram,is_published
FROM products WHERE id='p0000001-0000-0000-0000-000000000001';

INSERT IGNORE INTO orders
    (id,order_number,customer_id,shipping_address_id,order_status_id,warehouse_id,
     total_gross_amount,discount_amount,tax_amount,shipping_fee,total_net_amount)
SELECT '1','ORD-GATEWAY-001',o.customer_id,o.shipping_address_id,o.order_status_id,
       o.warehouse_id,p.base_price,0,0,0,p.base_price
FROM orders o JOIN products p ON p.id='1'
WHERE o.id='ord00001-0000-0000-0000-000000000001';

INSERT IGNORE INTO order_items (id,order_id,product_id,quantity,unit_price,subtotal)
SELECT 'gateway-demo-item-1','1',id,1,base_price,base_price
FROM products WHERE id='1';

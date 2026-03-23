-- Migration: Rename columns from snake_case to camelCase
-- Run this in Supabase SQL Editor to fix the column naming mismatch

-- Rename columns in products table
ALTER TABLE products RENAME COLUMN is_returnable TO "isReturnable";
ALTER TABLE products RENAME COLUMN return_days TO "returnDays";
ALTER TABLE products RENAME COLUMN is_new TO "isNew";
ALTER TABLE products RENAME COLUMN created_at TO "createdAt";
ALTER TABLE products RENAME COLUMN updated_at TO "updatedAt";

-- Rename columns in categories table
ALTER TABLE categories RENAME COLUMN created_at TO "createdAt";

-- Rename columns in orders table  
ALTER TABLE orders RENAME COLUMN customer_name TO "customerName";
ALTER TABLE orders RENAME COLUMN customer_email TO "customerEmail";
ALTER TABLE orders RENAME COLUMN customer_phone TO "customerPhone";
ALTER TABLE orders RENAME COLUMN shipping_address TO "shippingAddress";
ALTER TABLE orders RENAME COLUMN total_amount TO "totalAmount";
ALTER TABLE orders RENAME COLUMN payment_status TO "paymentStatus";
ALTER TABLE orders RENAME COLUMN created_at TO "createdAt";
ALTER TABLE orders RENAME COLUMN updated_at TO "updatedAt";

-- Update indexes to use new column names
DROP INDEX IF EXISTS idx_products_created_at;
CREATE INDEX idx_products_created_at ON products("createdAt" DESC);

DROP INDEX IF EXISTS idx_orders_created_at;
CREATE INDEX idx_orders_created_at ON orders("createdAt" DESC);

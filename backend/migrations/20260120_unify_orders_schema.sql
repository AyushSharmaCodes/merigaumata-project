-- Migration: Unify orders table schema to snake_case
-- Purpose: Remove redundant camelCase columns if they exist
-- Safe: Does nothing if columns don't exist

-- Drop camelCase columns ONLY IF THEY EXIST
-- No data sync needed since columns don't exist in this database

ALTER TABLE orders DROP COLUMN IF EXISTS "customerName";
ALTER TABLE orders DROP COLUMN IF EXISTS "customerEmail";
ALTER TABLE orders DROP COLUMN IF EXISTS "customerPhone";
ALTER TABLE orders DROP COLUMN IF EXISTS "shippingAddress";
ALTER TABLE orders DROP COLUMN IF EXISTS "billingAddress";
ALTER TABLE orders DROP COLUMN IF EXISTS "totalAmount";
ALTER TABLE orders DROP COLUMN IF EXISTS "paymentStatus";
ALTER TABLE orders DROP COLUMN IF EXISTS "orderNumber";
ALTER TABLE orders DROP COLUMN IF EXISTS "createdAt";
ALTER TABLE orders DROP COLUMN IF EXISTS "updatedAt";

-- Verify snake_case columns exist (ensure schema is correct)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_name') THEN
        RAISE EXCEPTION 'Missing required column: customer_name';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
        RAISE EXCEPTION 'Missing required column: payment_status';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_number') THEN
        RAISE EXCEPTION 'Missing required column: order_number';
    END IF;
END $$;

-- Migration complete - schema should now only have snake_case columns

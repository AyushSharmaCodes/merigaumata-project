-- Migration: Unify Product Schema to snake_case and Ensure Missing Columns
-- Created: 2026-01-17
-- Description: Reverts camelCase renames and ensures all required columns exist for products.

DO $$ 
BEGIN 
    -- 1. Ensure columns exist and have correct names (revert camelCase if present)
    
    -- is_returnable
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'isReturnable') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_returnable') THEN
            -- Both exist, update snake_case from camelCase if data might be newer, then drop camelCase
            UPDATE products SET is_returnable = "isReturnable" WHERE is_returnable IS NULL;
            ALTER TABLE products DROP COLUMN "isReturnable";
        ELSE
            ALTER TABLE products RENAME COLUMN "isReturnable" TO is_returnable;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_returnable') THEN
        ALTER TABLE products ADD COLUMN is_returnable BOOLEAN DEFAULT true;
    END IF;

    -- return_days
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'returnDays') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'return_days') THEN
            UPDATE products SET return_days = "returnDays" WHERE return_days IS NULL OR return_days = 0;
            ALTER TABLE products DROP COLUMN "returnDays";
        ELSE
            ALTER TABLE products RENAME COLUMN "returnDays" TO return_days;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'return_days') THEN
        ALTER TABLE products ADD COLUMN return_days INTEGER DEFAULT 3;
    END IF;

    -- is_new
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'isNew') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_new') THEN
            UPDATE products SET is_new = "isNew" WHERE is_new IS NULL OR is_new = false;
            ALTER TABLE products DROP COLUMN "isNew";
        ELSE
            ALTER TABLE products RENAME COLUMN "isNew" TO is_new;
        END IF;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'is_new') THEN
        ALTER TABLE products ADD COLUMN is_new BOOLEAN DEFAULT false;
    END IF;

    -- created_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'createdAt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'created_at') THEN
            ALTER TABLE products DROP COLUMN "createdAt";
        ELSE
            ALTER TABLE products RENAME COLUMN "createdAt" TO created_at;
        END IF;
    END IF;

    -- updated_at
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updatedAt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'updated_at') THEN
            ALTER TABLE products DROP COLUMN "updatedAt";
        ELSE
            ALTER TABLE products RENAME COLUMN "updatedAt" TO updated_at;
        END IF;
    END IF;

    -- 2. Similar unification for categories if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'createdAt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'created_at') THEN
            ALTER TABLE categories DROP COLUMN "createdAt";
        ELSE
            ALTER TABLE categories RENAME COLUMN "createdAt" TO created_at;
        END IF;
    END IF;

    -- 3. Similar unification for orders if needed
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customerName') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_name') THEN
            ALTER TABLE orders DROP COLUMN "customerName";
        ELSE
            ALTER TABLE orders RENAME COLUMN "customerName" TO customer_name;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customerEmail') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_email') THEN
            ALTER TABLE orders DROP COLUMN "customerEmail";
        ELSE
            ALTER TABLE orders RENAME COLUMN "customerEmail" TO customer_email;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customerPhone') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_phone') THEN
            ALTER TABLE orders DROP COLUMN "customerPhone";
        ELSE
            ALTER TABLE orders RENAME COLUMN "customerPhone" TO customer_phone;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shippingAddress') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipping_address') THEN
            ALTER TABLE orders DROP COLUMN "shippingAddress";
        ELSE
            ALTER TABLE orders RENAME COLUMN "shippingAddress" TO shipping_address;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'totalAmount') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_amount') THEN
            ALTER TABLE orders DROP COLUMN "totalAmount";
        ELSE
            ALTER TABLE orders RENAME COLUMN "totalAmount" TO total_amount;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentStatus') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'payment_status') THEN
            ALTER TABLE orders DROP COLUMN "paymentStatus";
        ELSE
            ALTER TABLE orders RENAME COLUMN "paymentStatus" TO payment_status;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'createdAt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'created_at') THEN
            ALTER TABLE orders DROP COLUMN "createdAt";
        ELSE
            ALTER TABLE orders RENAME COLUMN "createdAt" TO created_at;
        END IF;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updatedAt') THEN
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'updated_at') THEN
            ALTER TABLE orders DROP COLUMN "updatedAt";
        ELSE
            ALTER TABLE orders RENAME COLUMN "updatedAt" TO updated_at;
        END IF;
    END IF;

END $$;

-- 4. Re-create indexes with correct names
DROP INDEX IF EXISTS idx_products_created_at;
CREATE INDEX idx_products_created_at ON products(created_at DESC);

DROP INDEX IF EXISTS idx_orders_created_at;
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

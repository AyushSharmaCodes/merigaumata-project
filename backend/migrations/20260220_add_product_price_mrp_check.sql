-- Migration: Add CHECK constraint to products table
-- Created: 2026-02-20
-- Description: Ensures that price <= mrp for valid data persistence

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'chk_product_price_mrp_logic'
    ) THEN
        ALTER TABLE products
        ADD CONSTRAINT chk_product_price_mrp_logic CHECK (price <= mrp);
    END IF;
END $$;

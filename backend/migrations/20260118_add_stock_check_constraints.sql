-- Migration: Add check constraints for non-negative stock
-- File: 20260118_add_stock_check_constraints.sql

-- Add check constraint to products table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'products_inventory_check'
    ) THEN
        ALTER TABLE products 
        ADD CONSTRAINT products_inventory_check CHECK (inventory >= 0);
    END IF;
END $$;

-- Add check constraint to product_variants table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.check_constraints 
        WHERE constraint_name = 'product_variants_stock_quantity_check'
    ) THEN
        ALTER TABLE product_variants 
        ADD CONSTRAINT product_variants_stock_quantity_check CHECK (stock_quantity >= 0);
    END IF;
END $$;

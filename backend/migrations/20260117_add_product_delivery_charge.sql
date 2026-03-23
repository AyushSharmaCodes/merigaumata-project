-- Add delivery_charge to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0;
COMMENT ON COLUMN products.delivery_charge IS 'Product-specific delivery charge in INR, applied per unit';

-- Add delivery_charge to product_variants table (for overrides)
ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT NULL;
COMMENT ON COLUMN product_variants.delivery_charge IS 'Variant-specific delivery charge override (NULL = use product default)';

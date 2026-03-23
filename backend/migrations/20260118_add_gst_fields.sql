-- Migration: Add GST Configuration Fields
-- Created: 2026-01-18
-- Description: Adds GST configuration columns to products and product_variants tables

-- 1. Add columns to PRODUCTS table (Global/Default settings)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_gst_applicable BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 0 CHECK (gst_rate IN (0, 5, 12, 18, 28)),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(10);

COMMENT ON COLUMN products.is_gst_applicable IS 'Master switch for GST applicability on this product';
COMMENT ON COLUMN products.gst_rate IS 'Default GST rate (0, 5, 12, 18, 28)';
COMMENT ON COLUMN products.hsn_code IS 'Harmonized System of Nomenclature code';

-- 2. Add columns to PRODUCT_VARIANTS table (Overrides)
ALTER TABLE product_variants 
ADD COLUMN IF NOT EXISTS is_gst_applicable BOOLEAN DEFAULT NULL, -- NULL means inherit from product
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT NULL CHECK (gst_rate IN (0, 5, 12, 18, 28) OR gst_rate IS NULL),
ADD COLUMN IF NOT EXISTS hsn_code VARCHAR(10) DEFAULT NULL;

COMMENT ON COLUMN product_variants.is_gst_applicable IS 'Override product GST setting. NULL = inherit';
COMMENT ON COLUMN product_variants.gst_rate IS 'Override product GST rate. NULL = inherit';

-- 3. Add columns to DELIVERY_CONFIGS table (if not exists)
ALTER TABLE delivery_configs 
ADD COLUMN IF NOT EXISTS is_gst_applicable BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS gst_rate DECIMAL(5,2) DEFAULT 18 CHECK (gst_rate IN (0, 5, 12, 18, 28));

COMMENT ON COLUMN delivery_configs.is_gst_applicable IS 'Whether GST is charged on delivery';


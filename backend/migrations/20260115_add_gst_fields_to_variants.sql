-- Migration: Add GST Fields to Product Variants
-- Created: 2026-01-15
-- Description: Adds optional GST metadata to product_variants table for tax calculation

-- ============================================================================
-- 1. ADD GST COLUMNS TO PRODUCT_VARIANTS TABLE
-- ============================================================================

-- HSN Code (Harmonized System Nomenclature) - 4 to 8 digit code
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' AND column_name = 'hsn_code'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN hsn_code VARCHAR(8);
        COMMENT ON COLUMN product_variants.hsn_code IS 'Harmonized System Number for GST classification (4-8 digits)';
    END IF;
END $$;

-- GST Rate (0, 5, 12, 18, 28 are standard rates)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' AND column_name = 'gst_rate'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN gst_rate DECIMAL(5,2) DEFAULT NULL;
        ALTER TABLE product_variants ADD CONSTRAINT chk_gst_rate_valid 
            CHECK (gst_rate IS NULL OR gst_rate IN (0, 5, 12, 18, 28));
        COMMENT ON COLUMN product_variants.gst_rate IS 'GST percentage rate (0, 5, 12, 18, or 28)';
    END IF;
END $$;

-- Tax Applicable flag
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' AND column_name = 'tax_applicable'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN tax_applicable BOOLEAN DEFAULT false;
        COMMENT ON COLUMN product_variants.tax_applicable IS 'Whether GST applies to this variant';
    END IF;
END $$;

-- Price Includes Tax flag
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' AND column_name = 'price_includes_tax'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN price_includes_tax BOOLEAN DEFAULT true;
        COMMENT ON COLUMN product_variants.price_includes_tax IS 'Whether selling_price includes GST (true) or is exclusive (false)';
    END IF;
END $$;

-- ============================================================================
-- 2. ADD PRODUCT-LEVEL DEFAULT TAX METADATA
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'default_hsn_code'
    ) THEN
        ALTER TABLE products ADD COLUMN default_hsn_code VARCHAR(8);
        ALTER TABLE products ADD COLUMN default_gst_rate DECIMAL(5,2);
        ALTER TABLE products ADD COLUMN default_tax_applicable BOOLEAN DEFAULT false;
        
        COMMENT ON COLUMN products.default_hsn_code IS 'Default HSN code for variants without specific HSN';
        COMMENT ON COLUMN products.default_gst_rate IS 'Default GST rate for variants without specific rate';
        COMMENT ON COLUMN products.default_tax_applicable IS 'Default tax applicability for variants';
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEX FOR TAX QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_product_variants_tax_applicable 
    ON product_variants(tax_applicable) 
    WHERE tax_applicable = true;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE product_variants IS 'Size-based variants for products with independent pricing, inventory, and optional GST metadata';

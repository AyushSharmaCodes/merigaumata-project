-- Migration: Product Variants System
-- Created: 2026-01-15
-- Description: Adds product_variants table for size-based pricing and inventory management

-- ============================================================================
-- 1. CREATE PRODUCT_VARIANTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    
    -- Size Information
    size_label VARCHAR(50) NOT NULL,           -- Display label: "1 KG", "500 GM"
    size_value DECIMAL(10,2) NOT NULL,         -- Numeric value: 1, 0.5, 2
    unit VARCHAR(20) NOT NULL DEFAULT 'kg',    -- Unit: kg, gm, ltr, ml, pcs
    
    -- Pricing
    mrp DECIMAL(10,2) NOT NULL,                -- Maximum Retail Price
    selling_price DECIMAL(10,2) NOT NULL,      -- Selling Price (must be ≤ MRP)
    
    -- Inventory
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    
    -- Media
    variant_image_url TEXT,                    -- Optional variant-specific image
    
    -- Flags
    is_default BOOLEAN NOT NULL DEFAULT false, -- One default variant per product
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT chk_variant_selling_price CHECK (selling_price <= mrp),
    CONSTRAINT chk_variant_stock_non_negative CHECK (stock_quantity >= 0),
    CONSTRAINT chk_variant_size_value_positive CHECK (size_value > 0),
    CONSTRAINT chk_variant_unit CHECK (unit IN ('kg', 'gm', 'ltr', 'ml', 'pcs')),
    CONSTRAINT unique_product_size_label UNIQUE (product_id, size_label)
);

-- Ensure products table has return policy and timestamp fields (Required for RPC)
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_returnable BOOLEAN DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS return_days INTEGER DEFAULT 3;
ALTER TABLE products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for fetching variants by product
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id 
    ON product_variants(product_id);

-- Composite index for sorting by size
CREATE INDEX IF NOT EXISTS idx_product_variants_product_size 
    ON product_variants(product_id, size_value);

-- Partial index for finding default variant quickly
CREATE INDEX IF NOT EXISTS idx_product_variants_default 
    ON product_variants(product_id) 
    WHERE is_default = true;

-- ============================================================================
-- 3. TRIGGER: Ensure only one default variant per product
-- ============================================================================

CREATE OR REPLACE FUNCTION ensure_single_default_variant()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting this variant as default, unset other defaults for same product
    IF NEW.is_default = true THEN
        UPDATE product_variants 
        SET is_default = false, updated_at = NOW()
        WHERE product_id = NEW.product_id 
          AND id != NEW.id 
          AND is_default = true;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_single_default_variant ON product_variants;
CREATE TRIGGER trg_ensure_single_default_variant
    BEFORE INSERT OR UPDATE OF is_default ON product_variants
    FOR EACH ROW
    WHEN (NEW.is_default = true)
    EXECUTE FUNCTION ensure_single_default_variant();

-- ============================================================================
-- 4. TRIGGER: Auto-update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_variant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_variant_timestamp ON product_variants;
CREATE TRIGGER trg_update_variant_timestamp
    BEFORE UPDATE ON product_variants
    FOR EACH ROW
    EXECUTE FUNCTION update_variant_timestamp();

-- ============================================================================
-- 5. EXTEND CART_ITEMS TABLE (Backward Compatible)
-- ============================================================================

-- Add optional variant_id column to cart_items
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'cart_items' AND column_name = 'variant_id'
    ) THEN
        ALTER TABLE cart_items 
            ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
        
        -- Index for variant lookups in cart
        CREATE INDEX IF NOT EXISTS idx_cart_items_variant_id ON cart_items(variant_id);
    END IF;
END $$;

-- ============================================================================
-- 6. EXTEND ORDER_ITEMS TABLE (Backward Compatible)
-- ============================================================================

-- Add variant tracking to order_items for historical accuracy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'variant_id'
    ) THEN
        ALTER TABLE order_items 
            ADD COLUMN variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL;
        
        ALTER TABLE order_items 
            ADD COLUMN variant_size_label VARCHAR(50);
        
        ALTER TABLE order_items 
            ADD COLUMN variant_mrp DECIMAL(10,2);
    END IF;
END $$;

-- ============================================================================
-- 7. ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- Public read access (products are publicly viewable)
DROP POLICY IF EXISTS "product_variants_select_public" ON product_variants;
CREATE POLICY "product_variants_select_public" ON product_variants
    FOR SELECT
    USING (true);

-- Admin/Manager write access
DROP POLICY IF EXISTS "product_variants_insert_admin" ON product_variants;
CREATE POLICY "product_variants_insert_admin" ON product_variants
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() 
            AND r.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "product_variants_update_admin" ON product_variants;
CREATE POLICY "product_variants_update_admin" ON product_variants
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() 
            AND r.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "product_variants_delete_admin" ON product_variants;
CREATE POLICY "product_variants_delete_admin" ON product_variants
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() 
            AND r.name IN ('admin', 'manager')
        )
    );

-- ============================================================================
-- 8. HELPER FUNCTION: Get product with default variant
-- ============================================================================

CREATE OR REPLACE FUNCTION get_product_with_default_variant(p_product_id UUID)
RETURNS TABLE (
    id UUID,
    title TEXT,
    description TEXT,
    price DECIMAL,
    mrp DECIMAL,
    images TEXT[],
    category TEXT,
    inventory INTEGER,
    default_variant_id UUID,
    default_size_label VARCHAR,
    default_selling_price DECIMAL,
    default_mrp DECIMAL,
    default_stock INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id,
        p.title,
        p.description,
        p.price,
        p.mrp,
        p.images,
        p.category,
        p.inventory,
        v.id as default_variant_id,
        v.size_label as default_size_label,
        v.selling_price as default_selling_price,
        v.mrp as default_mrp,
        v.stock_quantity as default_stock
    FROM products p
    LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_default = true
    WHERE p.id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE product_variants IS 'Size-based variants for products with independent pricing and inventory';

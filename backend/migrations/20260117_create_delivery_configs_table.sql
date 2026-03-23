-- Migration: Create delivery_configs table for dynamic delivery charge calculation
-- Created: 2026-01-17
-- Purpose: Store product/variant-level delivery configuration rules

-- Create delivery_configs table
CREATE TABLE IF NOT EXISTS delivery_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope TEXT NOT NULL CHECK (scope IN ('PRODUCT', 'VARIANT')),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
    calculation_type TEXT NOT NULL CHECK (calculation_type IN 
        ('FLAT_PER_ORDER', 'PER_PACKAGE', 'WEIGHT_BASED', 'PER_ITEM')),
    base_delivery_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_items_per_package INTEGER DEFAULT 3,
    unit_weight DECIMAL(10,3) DEFAULT NULL,
    gst_percentage DECIMAL(5,2) NOT NULL DEFAULT 18,
    is_taxable BOOLEAN NOT NULL DEFAULT true,
    delivery_refund_policy TEXT NOT NULL DEFAULT 'REFUNDABLE' 
        CHECK (delivery_refund_policy IN ('REFUNDABLE', 'NON_REFUNDABLE')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_scope_product CHECK (
        (scope = 'PRODUCT' AND product_id IS NOT NULL AND variant_id IS NULL) OR
        (scope = 'VARIANT' AND variant_id IS NOT NULL AND product_id IS NULL)
    ),
    CONSTRAINT check_max_items_positive CHECK (max_items_per_package >= 1),
    CONSTRAINT check_base_charge_non_negative CHECK (base_delivery_charge >= 0),
    CONSTRAINT check_gst_valid CHECK (gst_percentage >= 0 AND gst_percentage <= 100)
);

-- Add delivery_refund_policy column if it doesn't exist (for existing tables)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_configs' 
        AND column_name = 'delivery_refund_policy'
    ) THEN
        ALTER TABLE delivery_configs 
        ADD COLUMN delivery_refund_policy TEXT NOT NULL DEFAULT 'REFUNDABLE' 
            CHECK (delivery_refund_policy IN ('REFUNDABLE', 'NON_REFUNDABLE'));
    END IF;
END $$;

-- Create unique indexes (IF NOT EXISTS to make migration idempotent)
DROP INDEX IF EXISTS idx_delivery_configs_product;
CREATE UNIQUE INDEX idx_delivery_configs_product 
    ON delivery_configs(product_id) 
    WHERE scope = 'PRODUCT' AND product_id IS NOT NULL;

DROP INDEX IF EXISTS idx_delivery_configs_variant;
CREATE UNIQUE INDEX idx_delivery_configs_variant 
    ON delivery_configs(variant_id) 
    WHERE scope = 'VARIANT' AND variant_id IS NOT NULL;

-- Create index for efficient lookups
DROP INDEX IF EXISTS idx_delivery_configs_scope;
CREATE INDEX idx_delivery_configs_scope ON delivery_configs(scope);

-- Add comments
COMMENT ON TABLE delivery_configs IS 'Stores delivery charge calculation rules for products and variants';
COMMENT ON COLUMN delivery_configs.scope IS 'Configuration scope: PRODUCT or VARIANT';
COMMENT ON COLUMN delivery_configs.calculation_type IS 'Type of calculation: FLAT_PER_ORDER, PER_PACKAGE, WEIGHT_BASED, or PER_ITEM';
COMMENT ON COLUMN delivery_configs.base_delivery_charge IS 'Base delivery charge in INR';
COMMENT ON COLUMN delivery_configs.max_items_per_package IS 'Maximum items per package (for PER_PACKAGE calculation)';
COMMENT ON COLUMN delivery_configs.unit_weight IS 'Weight per unit in kg (for WEIGHT_BASED calculation)';
COMMENT ON COLUMN delivery_configs.gst_percentage IS 'GST percentage to apply on delivery charges';
COMMENT ON COLUMN delivery_configs.is_taxable IS 'Whether delivery charges are taxable';
COMMENT ON COLUMN delivery_configs.delivery_refund_policy IS 'Delivery charge refund policy: REFUNDABLE or NON_REFUNDABLE (controls if delivery charges are refunded on returns)';

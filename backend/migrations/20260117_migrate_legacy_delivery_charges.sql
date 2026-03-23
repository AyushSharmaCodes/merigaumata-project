-- Migration: Migrate Legacy Delivery Charges to Delivery Configs
-- Date: 2026-01-17
-- Description: Moves existing legacy 'delivery_charge' values from 'products' table to 'delivery_configs' table for standardization.

-- Add is_active column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_configs' 
        AND column_name = 'is_active'
    ) THEN
        ALTER TABLE delivery_configs ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

DO $$
DECLARE
    migrated_count INT;
BEGIN
    -- Insert into delivery_configs for products having a legacy charge > 0
    -- ONLY if a config doesn't already exist for that product
    WITH inserted AS (
        INSERT INTO delivery_configs (
            product_id,
            scope,
            calculation_type,
            base_delivery_charge,
            is_active,
            gst_percentage,
            is_taxable,
            delivery_refund_policy,
            created_at,
            updated_at
        )
        SELECT 
            id, 
            'PRODUCT', 
            'FLAT_PER_ORDER', 
            delivery_charge, 
            true, 
            18, -- Defaulting to 18% as per standard requirement
            true,
            'NON_REFUNDABLE', -- Legacy policy default
            now(),
            now()
        FROM products 
        WHERE delivery_charge > 0 
        AND NOT EXISTS (
            SELECT 1 FROM delivery_configs WHERE product_id = products.id AND scope = 'PRODUCT'
        )
        RETURNING id
    )
    SELECT COUNT(*) INTO migrated_count FROM inserted;

    RAISE NOTICE 'Migrated % legacy delivery charges to delivery_configs.', migrated_count;
END $$;

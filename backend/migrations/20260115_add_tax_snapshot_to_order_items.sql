-- Migration: Add Tax Snapshot to Order Items
-- Created: 2026-01-15
-- Description: Adds immutable tax snapshot columns to order_items for financial accuracy and audit

-- ============================================================================
-- 1. ADD TAX SNAPSHOT COLUMNS TO ORDER_ITEMS TABLE
-- ============================================================================

-- Taxable Amount (pre-tax value)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'taxable_amount'
    ) THEN
        ALTER TABLE order_items ADD COLUMN taxable_amount DECIMAL(10,2);
        COMMENT ON COLUMN order_items.taxable_amount IS 'Pre-tax amount for the item (immutable snapshot)';
    END IF;
END $$;

-- CGST (Central GST)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'cgst'
    ) THEN
        ALTER TABLE order_items ADD COLUMN cgst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN order_items.cgst IS 'Central GST amount (immutable snapshot)';
    END IF;
END $$;

-- SGST (State GST)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'sgst'
    ) THEN
        ALTER TABLE order_items ADD COLUMN sgst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN order_items.sgst IS 'State GST amount (immutable snapshot)';
    END IF;
END $$;

-- IGST (Integrated GST)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'igst'
    ) THEN
        ALTER TABLE order_items ADD COLUMN igst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN order_items.igst IS 'Integrated GST amount for inter-state (immutable snapshot)';
    END IF;
END $$;

-- HSN Code Snapshot
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'hsn_code'
    ) THEN
        ALTER TABLE order_items ADD COLUMN hsn_code VARCHAR(8);
        COMMENT ON COLUMN order_items.hsn_code IS 'HSN code at time of order (immutable snapshot)';
    END IF;
END $$;

-- GST Rate Snapshot
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'gst_rate'
    ) THEN
        ALTER TABLE order_items ADD COLUMN gst_rate DECIMAL(5,2);
        COMMENT ON COLUMN order_items.gst_rate IS 'GST rate at time of order (immutable snapshot)';
    END IF;
END $$;

-- Variant Snapshot (full variant details at order time)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'variant_snapshot'
    ) THEN
        ALTER TABLE order_items ADD COLUMN variant_snapshot JSONB;
        COMMENT ON COLUMN order_items.variant_snapshot IS 'Complete variant details at order time for audit trail';
    END IF;
END $$;

-- Total Amount (including tax)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'order_items' AND column_name = 'total_amount'
    ) THEN
        ALTER TABLE order_items ADD COLUMN total_amount DECIMAL(10,2);
        COMMENT ON COLUMN order_items.total_amount IS 'Total amount including tax (taxable + cgst + sgst + igst)';
    END IF;
END $$;

-- ============================================================================
-- 2. ADD CONSTRAINT FOR TAX CONSISTENCY
-- ============================================================================

-- Ensure either CGST+SGST or IGST is set (not both)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_tax_split_consistency'
    ) THEN
        ALTER TABLE order_items ADD CONSTRAINT chk_tax_split_consistency
            CHECK (
                (cgst IS NULL AND sgst IS NULL AND igst IS NULL) OR  -- No tax
                (cgst >= 0 AND sgst >= 0 AND igst = 0) OR             -- Intra-state
                (cgst = 0 AND sgst = 0 AND igst >= 0)                 -- Inter-state
            );
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE order_items IS 'Order line items with immutable tax snapshot for GST compliance and audit';

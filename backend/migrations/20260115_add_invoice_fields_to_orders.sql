-- Migration: Add Invoice Fields to Orders
-- Created: 2026-01-15
-- Description: Adds Razorpay invoice reference columns to orders table

-- ============================================================================
-- 1. ADD INVOICE REFERENCE COLUMNS TO ORDERS TABLE
-- ============================================================================

-- Razorpay Invoice ID
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'invoice_id'
    ) THEN
        ALTER TABLE orders ADD COLUMN invoice_id VARCHAR(50);
        COMMENT ON COLUMN orders.invoice_id IS 'Razorpay invoice ID (e.g., inv_XXX)';
    END IF;
END $$;

-- Invoice Number
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'invoice_number'
    ) THEN
        ALTER TABLE orders ADD COLUMN invoice_number VARCHAR(50);
        COMMENT ON COLUMN orders.invoice_number IS 'Razorpay-generated invoice number';
    END IF;
END $$;

-- Invoice URL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'invoice_url'
    ) THEN
        ALTER TABLE orders ADD COLUMN invoice_url TEXT;
        COMMENT ON COLUMN orders.invoice_url IS 'Short URL for customer to download invoice';
    END IF;
END $$;

-- Invoice Status (for tracking generation lifecycle)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'invoice_status'
    ) THEN
        ALTER TABLE orders ADD COLUMN invoice_status VARCHAR(20) DEFAULT NULL;
        ALTER TABLE orders ADD CONSTRAINT chk_invoice_status_valid
            CHECK (invoice_status IS NULL OR invoice_status IN ('pending', 'generated', 'failed'));
        COMMENT ON COLUMN orders.invoice_status IS 'Invoice generation status: pending, generated, or failed';
    END IF;
END $$;

-- Invoice Generated At
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'invoice_generated_at'
    ) THEN
        ALTER TABLE orders ADD COLUMN invoice_generated_at TIMESTAMPTZ;
        COMMENT ON COLUMN orders.invoice_generated_at IS 'Timestamp when invoice was generated';
    END IF;
END $$;

-- ============================================================================
-- 2. ADD TAX SUMMARY COLUMNS TO ORDERS TABLE
-- ============================================================================

-- Total CGST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_cgst'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_cgst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN orders.total_cgst IS 'Sum of CGST from all order items';
    END IF;
END $$;

-- Total SGST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_sgst'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_sgst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN orders.total_sgst IS 'Sum of SGST from all order items';
    END IF;
END $$;

-- Total IGST
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_igst'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_igst DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN orders.total_igst IS 'Sum of IGST from all order items (inter-state)';
    END IF;
END $$;

-- Total Taxable Amount
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'orders' AND column_name = 'total_taxable_amount'
    ) THEN
        ALTER TABLE orders ADD COLUMN total_taxable_amount DECIMAL(10,2) DEFAULT 0;
        COMMENT ON COLUMN orders.total_taxable_amount IS 'Sum of taxable amounts before GST';
    END IF;
END $$;

-- ============================================================================
-- 3. CREATE INDEX FOR INVOICE QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_invoice_status 
    ON orders(invoice_status) 
    WHERE invoice_status IS NOT NULL;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE orders IS 'Customer orders with invoice reference and tax summary for GST compliance';

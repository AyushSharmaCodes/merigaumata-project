-- Migration: Create Invoices Table
-- Created: 2026-01-18
-- Description: Stores metadata for both Razorpay payment receipts and Internal GST tax invoices

CREATE TYPE invoice_type AS ENUM ('RAZORPAY', 'TAX_INVOICE', 'BILL_OF_SUPPLY');
CREATE TYPE invoice_status AS ENUM ('PENDING', 'GENERATED', 'FAILED');

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    type invoice_type NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    
    -- Specific to Razorpay
    provider_id VARCHAR(100), -- e.g. inv_NnZ5...
    
    -- Specific to Internal
    file_path TEXT, -- Local storage path
    public_url TEXT, -- Publicly accessible URL (Razorpay short_url or our own signed URL)
    
    status invoice_status DEFAULT 'PENDING',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ, -- For 30-day retention logic
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_order_id ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_generated_at ON invoices(generated_at);

-- Add comments
COMMENT ON TABLE invoices IS 'Stores both Razorpay payment receipts and internal GST invoices';
COMMENT ON COLUMN invoices.type IS 'Distinguishes between Payment Receipt (Razorpay) and Legal Tax Invoice';
COMMENT ON COLUMN invoices.expires_at IS 'Date when the internal PDF file should be deleted (retention policy)';

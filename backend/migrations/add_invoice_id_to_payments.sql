-- Add invoice_id column to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(255);

-- Create index for invoice lookups
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);

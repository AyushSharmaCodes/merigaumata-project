-- Migration: Create bank_details table for managing bank account information and QR codes
-- Created: 2025-11-22

-- Create bank_details table
CREATE TABLE IF NOT EXISTS bank_details (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_name VARCHAR(255) NOT NULL,
  account_number VARCHAR(50) NOT NULL,
  ifsc_code VARCHAR(11) NOT NULL,
  bank_name VARCHAR(255) NOT NULL,
  branch_name VARCHAR(255),
  upi_id VARCHAR(100),
  type VARCHAR(20) NOT NULL CHECK (type IN ('general', 'donation')),
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  qr_code_auto_url TEXT,  -- Auto-generated QR URL from Supabase Storage
  qr_code_manual_url TEXT, -- Manually uploaded QR URL from Supabase Storage
  use_manual_qr BOOLEAN DEFAULT false,  -- If true, use manual QR, else use auto QR
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bank_details_type ON bank_details(type, is_active);
CREATE INDEX IF NOT EXISTS idx_bank_details_order ON bank_details(display_order);
CREATE INDEX IF NOT EXISTS idx_bank_details_active ON bank_details(is_active);

-- Enable Row Level Security
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public read active general bank details" ON bank_details;
DROP POLICY IF EXISTS "Authenticated read all bank details" ON bank_details;
DROP POLICY IF EXISTS "Admin full access" ON bank_details;

-- Policy 1: Public users can only view active general bank details (for footer display)
CREATE POLICY "Public read active general bank details"
  ON bank_details FOR SELECT
  TO anon, authenticated
  USING (is_active = true AND type = 'general');

-- Policy 2: Authenticated users can view all bank details (admin panel)
CREATE POLICY "Authenticated read all bank details"
  ON bank_details FOR SELECT
  TO authenticated
  USING (true);

-- Policy 3: Authenticated users can insert, update, delete (admin operations)
-- Note: You may want to add role-based checks here if you have a roles system
CREATE POLICY "Authenticated manage bank details"
  ON bank_details FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert some sample data for testing (optional - remove in production)
INSERT INTO bank_details (
  account_name,
  account_number,
  ifsc_code,
  bank_name,
  branch_name,
  upi_id,
  type,
  display_order,
  is_active
) VALUES
  (
    'Gaushala Trust',
    '1234567890123456',
    'SBIN0001234',
    'State Bank of India',
    'Main Branch',
    'gaushala@sbi',
    'general',
    1,
    true
  ),
  (
    'Gaushala Donation Account',
    '9876543210987654',
    'HDFC0002345',
    'HDFC Bank',
    'City Center',
    'donate.gaushala@hdfcbank',
    'donation',
    2,
    true
  )
ON CONFLICT DO NOTHING;

-- Note: Supabase Storage bucket 'qr-codes' should be created manually via Supabase Dashboard
-- with public access enabled for the QR code images to be viewable on the website.

COMMENT ON TABLE bank_details IS 'Stores bank account details and QR codes for payments';
COMMENT ON COLUMN bank_details.type IS 'general: shown in footer, donation: shown in donate page';
COMMENT ON COLUMN bank_details.use_manual_qr IS 'If true, display qr_code_manual_url instead of qr_code_auto_url';

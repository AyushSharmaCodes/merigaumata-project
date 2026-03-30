-- Donations Table
-- Stores all donation records (One-time and Monthly)
-- Ensures auditability and unique identification

CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_reference_id VARCHAR(50) UNIQUE NOT NULL, -- e.g., DON-2026-XXXX
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Nullable for anonymous
    type VARCHAR(20) CHECK (type IN ('one_time', 'monthly')) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    donor_name VARCHAR(255),
    donor_email VARCHAR(255),
    donor_phone VARCHAR(20),
    is_anonymous BOOLEAN DEFAULT FALSE,
    payment_status VARCHAR(20) DEFAULT 'pending', -- pending, success, failed
    razorpay_order_id VARCHAR(100),
    razorpay_payment_id VARCHAR(100),
    razorpay_subscription_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for faster lookups and reporting
CREATE INDEX IF NOT EXISTS idx_donations_reference_id ON donations(donation_reference_id);
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_email ON donations(donor_email);
CREATE INDEX IF NOT EXISTS idx_donations_type ON donations(type);
CREATE INDEX IF NOT EXISTS idx_donations_payment_status ON donations(payment_status);

-- Enable Row Level Security
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own non-anonymous donations
DROP POLICY IF EXISTS "Users can view own donations" ON donations;
CREATE POLICY "Users can view own donations"
ON donations FOR SELECT
USING (auth.uid() = user_id);

-- RLS Policy: Public can insert (for anonymous/guest donations)
-- Typically, backend uses service role, but for client-side inserts (if any) we need this.
-- However, standard flow is API-based. We'll enable it for authenticated users just in case.
DROP POLICY IF EXISTS "Users can insert own donations" ON donations;
CREATE POLICY "Users can insert own donations"
ON donations FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

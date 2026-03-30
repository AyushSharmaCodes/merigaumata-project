-- Donation Subscriptions Table
-- Tracks state of recurring donations (Active/Cancelled/etc)
CREATE TABLE IF NOT EXISTS donation_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) NOT NULL,
    donation_reference_id VARCHAR(50) UNIQUE NOT NULL,
    razorpay_subscription_id VARCHAR(100) UNIQUE NOT NULL,
    razorpay_plan_id VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(20) DEFAULT 'created', -- created, authenticated, active, pending, halted, cancelled, completed, expired
    current_start TIMESTAMP WITH TIME ZONE,
    current_end TIMESTAMP WITH TIME ZONE,
    next_billing_at TIMESTAMP WITH TIME ZONE,
    donor_name VARCHAR(255),
    donor_email VARCHAR(255),
    donor_phone VARCHAR(20),
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subs_user_id ON donation_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subs_rzp_id ON donation_subscriptions(razorpay_subscription_id);

ALTER TABLE donation_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON donation_subscriptions;
CREATE POLICY "Users can view own subscriptions"
ON donation_subscriptions FOR SELECT
USING (auth.uid() = user_id);

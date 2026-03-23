-- Create coupon_usage table for tracking coupon usage history
CREATE TABLE IF NOT EXISTS coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    discount_applied DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_id ON coupon_usage(coupon_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_used_at ON coupon_usage(used_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (access should be controlled at API level)
CREATE POLICY "Enable all operations for coupon_usage" ON coupon_usage
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE coupon_usage IS 'Tracks historical usage of coupons by users for analytics and auditing';
COMMENT ON COLUMN coupon_usage.coupon_id IS 'Reference to the coupon that was used';
COMMENT ON COLUMN coupon_usage.user_id IS 'Reference to the user who used the coupon';
COMMENT ON COLUMN coupon_usage.order_id IS 'Reference to the order where the coupon was applied';
COMMENT ON COLUMN coupon_usage.discount_applied IS 'Actual discount amount applied in rupees';
COMMENT ON COLUMN coupon_usage.used_at IS 'Timestamp when the coupon was used';

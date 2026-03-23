-- Create coupons table for storing discount coupons
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('product', 'category', 'cart')),
    discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    target_id TEXT, -- Product ID for 'product' type, category name for 'category' type, NULL for 'cart' type
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2), -- Maximum discount cap in rupees
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INTEGER, -- NULL means unlimited
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupons_valid_until ON coupons(valid_until);
CREATE INDEX IF NOT EXISTS idx_coupons_type ON coupons(type);

-- Add constraint to ensure target_id is set for product and category types
CREATE OR REPLACE FUNCTION check_coupon_target_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('product', 'category') AND NEW.target_id IS NULL THEN
        RAISE EXCEPTION 'target_id is required for product and category type coupons';
    END IF;
    
    IF NEW.type = 'cart' AND NEW.target_id IS NOT NULL THEN
        RAISE EXCEPTION 'target_id should be NULL for cart type coupons';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_coupon_target_id
    BEFORE INSERT OR UPDATE ON coupons
    FOR EACH ROW
    EXECUTE FUNCTION check_coupon_target_id();

-- Enable Row Level Security (RLS)
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for now (admin-only access should be enforced at API level)
CREATE POLICY "Enable all operations for coupons" ON coupons
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Add comment for documentation
COMMENT ON TABLE coupons IS 'Stores discount coupons with support for product-level, category-level, and cart-level discounts';
COMMENT ON COLUMN coupons.code IS 'Unique coupon code (case-insensitive, stored in uppercase)';
COMMENT ON COLUMN coupons.type IS 'Type of coupon: product (specific product), category (product category), or cart (entire cart)';
COMMENT ON COLUMN coupons.discount_percentage IS 'Discount percentage (1-100)';
COMMENT ON COLUMN coupons.target_id IS 'Product ID for product-level coupons, category name for category-level coupons';
COMMENT ON COLUMN coupons.usage_limit IS 'Maximum number of times this coupon can be used across all users (NULL = unlimited)';
COMMENT ON COLUMN coupons.usage_count IS 'Current number of times this coupon has been used';

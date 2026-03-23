-- Add coupon-related columns to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_charge DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10, 2);

-- Add comments for new columns
COMMENT ON COLUMN orders.coupon_code IS 'Coupon code that was applied to this order (if any)';
COMMENT ON COLUMN orders.coupon_discount IS 'Discount amount from coupon in rupees';
COMMENT ON COLUMN orders.delivery_charge IS 'Delivery charge applied to this order';
COMMENT ON COLUMN orders.subtotal IS 'Subtotal before coupon discount and delivery charge';

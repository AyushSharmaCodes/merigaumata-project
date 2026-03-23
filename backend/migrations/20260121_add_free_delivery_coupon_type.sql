-- Update coupons type check constraint to include 'free_delivery'
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupons_type_check'
    ) THEN
        ALTER TABLE coupons DROP CONSTRAINT coupons_type_check;
    END IF;
END $$;

ALTER TABLE coupons ADD CONSTRAINT coupons_type_check 
    CHECK (type IN ('product', 'category', 'cart', 'variant', 'free_delivery'));

-- Update discount_percentage check constraint to allow 0 (for free_delivery)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupons_discount_percentage_check'
    ) THEN
        ALTER TABLE coupons DROP CONSTRAINT coupons_discount_percentage_check;
    END IF;
END $$;

ALTER TABLE coupons ADD CONSTRAINT coupons_discount_percentage_check 
    CHECK (discount_percentage >= 0 AND discount_percentage <= 100);

-- Update trigger function to handle free_delivery like cart (no target_id required/allowed)
CREATE OR REPLACE FUNCTION check_coupon_target_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('product', 'category') AND NEW.target_id IS NULL THEN
        RAISE EXCEPTION 'target_id is required for product and category type coupons';
    END IF;
    
    IF NEW.type IN ('cart', 'free_delivery') AND NEW.target_id IS NOT NULL THEN
        RAISE EXCEPTION 'target_id should be NULL for % type coupons', NEW.type;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

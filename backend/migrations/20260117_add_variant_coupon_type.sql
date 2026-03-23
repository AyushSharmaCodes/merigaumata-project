-- Update coupons type check constraint to include 'variant'
-- Drop the existing constraint (name assumed based on standard naming or explicit name if known, using explicit name from Create Table would be safer but standard 'coupons_type_check' is likely)
-- If the name was auto-generated, we might need to find it. But `create_coupons_table.sql` didn't specify a name, so Postgres auto-generates it usually as `coupons_type_check` or similar.
-- However, the safest way is to drop by column check or just use the likely name.
-- Based on the create statement: `type TEXT NOT NULL CHECK (type IN ('product', 'category', 'cart'))`
-- Postgres usually names it `coupons_type_check`.

DO $$
BEGIN
    -- Drop constraint if it exists (handling potentially different auto-generated names if needed, but standard is coupons_type_check)
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'coupons_type_check'
    ) THEN
        ALTER TABLE coupons DROP CONSTRAINT coupons_type_check;
    END IF;
END $$;

-- Re-add with 'variant' type
ALTER TABLE coupons ADD CONSTRAINT coupons_type_check 
    CHECK (type IN ('product', 'category', 'cart', 'variant'));

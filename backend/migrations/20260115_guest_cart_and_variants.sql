-- Migration: Guest Cart & Product Variant Enhancements

-- 1. Modify `carts` table to support Guest Carts
ALTER TABLE public.carts
ADD COLUMN IF NOT EXISTS guest_id text UNIQUE,
ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add Constraint: Either user_id or guest_id must be present, but not both null
-- (Though theoretically a cart could be transitioning, enforcing at least one id is good practice)
ALTER TABLE public.carts
ADD CONSTRAINT carts_user_or_guest_check
CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL);

-- 3. Modify `products` table for Variant Mode
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'variant_mode_type') THEN
        CREATE TYPE variant_mode_type AS ENUM ('UNIT', 'SIZE');
    END IF;
END $$;

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS variant_mode variant_mode_type DEFAULT 'UNIT';

-- 4. Modify `product_variants` table for description
ALTER TABLE public.product_variants
ADD COLUMN IF NOT EXISTS description text;

-- 5. Update RLS Policies for Carts to allow Guest Access
-- Current policies likely rely on auth.uid() = user_id. We need to allow access if guest_id matches.
-- Note: Security for guest_id relies on the backend service being the only interface, or explicit policies if exposing via API.
-- Since we are using Service Role (backend calls), RLS on tables matters less for Node code but matters for Client connectivity if used.
-- Assuming backend is primary accessor, but let's update policies for completeness/future-proofing.

-- Allow SELECT/INSERT/UPDATE/DELETE if guest_id matches (conceptually difficult without auth context for guest).
-- For now, we rely on Backend Service Role access (which bypasses RLS) for guest cart operations.
-- Regular authenticated users still use user_id.

-- 6. Add Index for guest_id
CREATE INDEX IF NOT EXISTS idx_carts_guest_id ON public.carts(guest_id);

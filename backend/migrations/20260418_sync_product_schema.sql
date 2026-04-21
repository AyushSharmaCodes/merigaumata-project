-- Recovery Migration to Sync Product and Variant Schema
-- Adds missing columns and renames incorrectly named columns to match backend service expectations

-- 1. Products Table
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) DEFAULT 0;

-- 2. Product Variants Table
-- Atomically rename price to selling_price if price exists and selling_price doesn't
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'price') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'product_variants' AND column_name = 'selling_price') THEN
        ALTER TABLE public.product_variants RENAME COLUMN price TO selling_price;
    END IF;
END $$;

-- Ensure selling_price exists (in case neither or both existed we handle it)
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS selling_price NUMERIC(10,2) DEFAULT 0;

-- Add other missing columns to product_variants
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS size_value NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS tax_applicable BOOLEAN DEFAULT true;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS gst_rate NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS price_includes_tax BOOLEAN DEFAULT true;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.product_variants ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- 3. Update comments for clarity
COMMENT ON COLUMN public.products.delivery_charge IS 'Product-level delivery surcharge';
COMMENT ON COLUMN public.product_variants.selling_price IS 'Actual selling price shown to users';
COMMENT ON COLUMN public.product_variants.delivery_charge IS 'Variant-level delivery surcharge override (null = use product default)';

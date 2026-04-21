-- ==============================================================================
-- MIGRATION: 20260419_repair_checkout_schema.sql
-- PURPOSE: 
-- 1. Fix `payments.invoice_id` type from UUID to TEXT (Critical for Razorpay)
-- 2. Restore missing tax/metadata columns to `order_items`
-- 3. Restore missing tax columns to `orders`
-- ==============================================================================

BEGIN;

-- 1. Fix `payments.invoice_id`
-- We use a DO block to safely change the column type
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payments' AND column_name = 'invoice_id' AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.payments ALTER COLUMN invoice_id TYPE TEXT USING invoice_id::text;
    END IF;
END $$;

-- 2. Repair `order_items` table
DO $$ 
BEGIN
    -- Financial/Tax Columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'taxable_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN taxable_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'cgst') THEN
        ALTER TABLE public.order_items ADD COLUMN cgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'sgst') THEN
        ALTER TABLE public.order_items ADD COLUMN sgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'igst') THEN
        ALTER TABLE public.order_items ADD COLUMN igst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'gst_rate') THEN
        ALTER TABLE public.order_items ADD COLUMN gst_rate NUMERIC(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'hsn_code') THEN
        ALTER TABLE public.order_items ADD COLUMN hsn_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'total_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN total_amount NUMERIC(12,2) DEFAULT 0;
    END IF;

    -- Snapshots
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'variant_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN variant_snapshot JSONB;
    END IF;
    
    -- Coupon Data
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'coupon_id') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'coupon_code') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'order_items' AND column_name = 'coupon_discount') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_discount NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

-- 3. Repair `orders` table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_taxable_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_taxable_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_cgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_cgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_sgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_sgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'total_igst') THEN
        ALTER TABLE public.orders ADD COLUMN total_igst NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

COMMIT;

-- Force PostgREST schema reload
NOTIFY pgrst, 'reload schema';

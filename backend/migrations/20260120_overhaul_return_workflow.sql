-- Migration: Overhaul Return Workflow Statuses
-- Description: Updates status constraints for returns and orders to support a multi-phase return lifecycle.

-- 1. Update Return Items Status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_items' AND column_name = 'status') THEN
        ALTER TABLE return_items ADD COLUMN status TEXT DEFAULT 'requested';
    END IF;
END $$;

-- 2. Update Returns Status Constraint
-- We need to drop the existing constraint and add a new one with more statuses.
-- First, find the constraint name (it's usually returns_status_check)
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.returns'::regclass AND contype = 'c' AND conname LIKE '%status%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.returns DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

ALTER TABLE public.returns 
ADD CONSTRAINT returns_status_check 
CHECK (status IN ('requested', 'approved', 'rejected', 'pickup_scheduled', 'picked_up', 'item_returned', 'cancelled', 'completed'));

-- 3. Update Orders Status Constraint
DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass AND contype = 'c' AND conname LIKE '%status%';
    
    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_status_check 
CHECK (status IN (
    'pending', 'confirmed', 'processing', 'packed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled', 
    'return_requested', 'return_approved', 'return_rejected', 
    'partially_returned', 'returned', 'refunded'
));

-- 4. Update Orders Payment Status Constraint
DO $$
BEGIN
    -- Ensure paymentStatus column exists for compatibility
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'paymentStatus') THEN
        ALTER TABLE public.orders ADD COLUMN "paymentStatus" TEXT DEFAULT 'pending';
    END IF;
END $$;

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    FOR constraint_name IN (
        SELECT conname 
        FROM pg_constraint 
        WHERE conrelid = 'public.orders'::regclass AND contype = 'c' AND (conname LIKE '%payment_status%' OR conname LIKE '%paymentStatus%')
    ) LOOP
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || constraint_name;
    END LOOP;
END $$;

ALTER TABLE public.orders 
ADD CONSTRAINT orders_payment_status_check 
CHECK (payment_status IN ('pending', 'paid', 'failed', 'refund_initiated', 'partially_refunded', 'refunded'));

ALTER TABLE public.orders 
ADD CONSTRAINT "orders_paymentStatus_check" 
CHECK ("paymentStatus" IN ('pending', 'paid', 'failed', 'refund_initiated', 'partially_refunded', 'refunded'));

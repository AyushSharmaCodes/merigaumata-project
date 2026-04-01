-- Migration: Fix returns and return_items schema for full lifecycle support
-- 1. Add refund_breakdown to returns table
-- 2. Add reason, images, condition to return_items table
-- 3. Update status check constraint for returns

-- 1. Add refund_breakdown column to returns if missing
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'refund_breakdown') THEN
        ALTER TABLE public.returns ADD COLUMN refund_breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- 2. Add columns to return_items if missing
DO $$ 
BEGIN 
    -- reason
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'reason') THEN
        ALTER TABLE public.return_items ADD COLUMN reason TEXT;
    END IF;
    
    -- images
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'images') THEN
        ALTER TABLE public.return_items ADD COLUMN images TEXT[] DEFAULT '{}'::text[];
    END IF;
    
    -- condition
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'condition') THEN
        ALTER TABLE public.return_items ADD COLUMN condition TEXT DEFAULT 'opened';
    END IF;
END $$;

-- 3. Relax returns status check constraint
-- Drop existing constraint if it exists (might have different name)
DO $$ 
DECLARE
    const_name TEXT;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint 
    WHERE conrelid = 'public.returns'::regclass 
    AND contype = 'c' 
    AND (pg_get_constraintdef(oid) LIKE '%status%' OR conname LIKE '%status%');
    
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.returns DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- Add updated status check constraint
ALTER TABLE public.returns 
ADD CONSTRAINT returns_status_check 
CHECK (status IN ('requested', 'approved', 'pickup_scheduled', 'picked_up', 'item_returned', 'rejected', 'cancelled', 'completed'));

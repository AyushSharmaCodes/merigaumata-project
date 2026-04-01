-- Migration: Fix returns and return_items schema for full lifecycle support
-- UPDATED: Align returns.user_id with profiles(id), not auth.users(id)

-- 1. Add missing columns to returns table
DO $$ 
BEGIN 
    -- user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'user_id') THEN
        ALTER TABLE public.returns ADD COLUMN user_id UUID;
    END IF;

    -- refund_breakdown
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'refund_breakdown') THEN
        ALTER TABLE public.returns ADD COLUMN refund_breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- reason (ensure it allows NULLs if it has a NOT NULL constraint)
    -- Or just make it NOT NULL with a default to avoid the constraint error
    ALTER TABLE public.returns ALTER COLUMN reason DROP NOT NULL;
    ALTER TABLE public.returns ALTER COLUMN user_id DROP NOT NULL;
END $$;

-- 1.1 Ensure returns.user_id points to profiles(id), not auth.users(id)
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_user_id_fkey;

ALTER TABLE public.returns
ADD CONSTRAINT returns_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

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

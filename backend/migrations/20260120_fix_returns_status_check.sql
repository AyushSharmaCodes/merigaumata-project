-- Migration: Fix returns_status_check constraint
-- Description: Updates the check constraint on the status column of the returns table to allow 'cancelled' and 'picked_up'.

DO $$
BEGIN
    -- Drop the existing constraint if it exists
    ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;

    -- Add the updated constraint
    ALTER TABLE public.returns ADD CONSTRAINT returns_status_check 
    CHECK (status IN ('requested', 'approved', 'rejected', 'completed', 'cancelled', 'picked_up'));
END $$;

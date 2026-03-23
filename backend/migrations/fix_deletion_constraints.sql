-- Fix User Deletion Constraints
-- This migration fixes Foreign Key constraints that block user deletion.
-- Specifically targeting: returns, donation_subscriptions, and ensuring order_status_history is correct.

DO $$ 
BEGIN 
    -- 1. Fix 'returns' table
    -- Drop existing constraint (name might vary, trying standard generated names)
    -- We first need to find the constraint name or blindly try dropping common ones
    
    -- Check if constraint exists effectively or just alter it
    -- Strategy: Drop conflicting constraints and re-add with correct rules
    
    -- Returns FK
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'returns' AND constraint_type = 'FOREIGN KEY'
    ) THEN
        -- Try to drop constraint by name if we can predict it, otherwise we might need dynamic SQL or specific knowledge.
        -- Standard naming: returns_user_id_fkey
        ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_user_id_fkey;
    END IF;

    -- Add back properly
    ALTER TABLE public.returns 
    ADD CONSTRAINT returns_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;


    -- 2. Fix 'donation_subscriptions' table
    -- First, make user_id nullable
    ALTER TABLE public.donation_subscriptions ALTER COLUMN user_id DROP NOT NULL;

    -- Drop old FK
    ALTER TABLE public.donation_subscriptions DROP CONSTRAINT IF EXISTS donation_subscriptions_user_id_fkey;

    -- Add new FK
    ALTER TABLE public.donation_subscriptions 
    ADD CONSTRAINT donation_subscriptions_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES auth.users(id) 
    ON DELETE SET NULL;


    -- 3. Double check 'order_status_history' (from previous fix)
    ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_updated_by_profile_fk;
    ALTER TABLE public.order_status_history DROP CONSTRAINT IF EXISTS order_status_history_updated_by_fkey;

    ALTER TABLE public.order_status_history
    ADD CONSTRAINT order_status_history_updated_by_profile_fk
    FOREIGN KEY (updated_by) 
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;

END $$;

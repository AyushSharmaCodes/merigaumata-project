-- Fix order_status_history relationship
-- We need to ensure updated_by references profiles(id) to allow joining
-- Supabase/PostgREST requires an explicit FK for joins

DO $$ 
BEGIN 
    -- 1. Check if constraint already exists (to avoid errors)
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'order_status_history_updated_by_profile_fk' 
        AND table_name = 'order_status_history'
    ) THEN
        -- 2. Add Foreign Key reference to profiles
        -- Note: profiles.id is NOT a PK in some setups (it's UUID referencing auth.users), 
        -- but if it has a unique constraint or PK, we can reference it.
        -- Usually profiles.id IS the PK.
        
        -- If updated_by was referencing auth.users, that's fine for auth, 
        -- but for fetching Profile data (names), updating the FK to point to public.profiles is better
        -- IF profile creation is guaranteed for every user.
        
        -- ALTER TABLE order_status_history DROP CONSTRAINT IF EXISTS order_status_history_updated_by_fkey; -- Remove old if strictly auth.users
        
        ALTER TABLE public.order_status_history
        ADD CONSTRAINT order_status_history_updated_by_profile_fk
        FOREIGN KEY (updated_by) 
        REFERENCES public.profiles(id);
        
    END IF;
END $$;

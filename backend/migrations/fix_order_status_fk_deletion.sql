-- Fix order_status_history FK to allow profile deletion
-- When a user is deleted (via profile deletion), we want to keep the history 
-- but set the updated_by field to NULL.

DO $$ 
BEGIN 
    -- 1. Drop existing constraints if they exist
    ALTER TABLE public.order_status_history 
    DROP CONSTRAINT IF EXISTS order_status_history_updated_by_profile_fk;
    
    ALTER TABLE public.order_status_history 
    DROP CONSTRAINT IF EXISTS order_status_history_updated_by_fkey;

    -- 2. Add new constraint with ON DELETE SET NULL
    ALTER TABLE public.order_status_history
    ADD CONSTRAINT order_status_history_updated_by_profile_fk
    FOREIGN KEY (updated_by) 
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
    
END $$;

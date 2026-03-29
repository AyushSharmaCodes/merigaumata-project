-- =====================================================
-- FIX: testimonials.user_id foreign key constraint
-- Created: 2026-03-29
-- Problem: user_id references auth.users(id) but the app uses
--          custom JWT tokens and stores users in profiles table.
--          Every INSERT fails with FK violation (error 23503).
-- Solution: Change FK to reference profiles(id) instead.
-- =====================================================

-- Step 1: Drop the existing broken FK constraint
ALTER TABLE IF EXISTS public.testimonials
    DROP CONSTRAINT IF EXISTS testimonials_user_id_fkey;

-- Step 2: Re-create FK referencing profiles(id) with ON DELETE SET NULL
ALTER TABLE IF EXISTS public.testimonials
    ADD CONSTRAINT testimonials_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Step 3: Verify
DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_name = 'testimonials'
      AND constraint_name = 'testimonials_user_id_fkey'
      AND constraint_type = 'FOREIGN KEY';

    IF fk_count = 1 THEN
        RAISE NOTICE 'testimonials_user_id_fkey successfully updated to reference profiles(id) ✓';
    ELSE
        RAISE WARNING 'testimonials_user_id_fkey NOT found after migration!';
    END IF;
END $$;

-- =====================================================
-- FIX: returns.user_id foreign key constraint
-- Created: 2026-04-01
-- Problem: returns.user_id references auth.users(id), but the app's
--          authenticated user IDs are stored in public.profiles(id).
--          This causes return creation to fail with 23503 on user_id.
-- Solution: Re-point the FK to public.profiles(id).
-- =====================================================

ALTER TABLE IF EXISTS public.returns
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.returns
    DROP CONSTRAINT IF EXISTS returns_user_id_fkey;

ALTER TABLE IF EXISTS public.returns
    ADD CONSTRAINT returns_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT returns_user_id_fkey ON public.returns IS 'Reference profiles(id) instead of auth.users(id)';

DO $$
DECLARE
    fk_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'returns'
      AND constraint_name = 'returns_user_id_fkey'
      AND constraint_type = 'FOREIGN KEY';

    IF fk_count = 1 THEN
        RAISE NOTICE 'returns_user_id_fkey successfully updated to reference profiles(id) ✓';
    ELSE
        RAISE WARNING 'returns_user_id_fkey NOT found after migration!';
    END IF;
END $$;

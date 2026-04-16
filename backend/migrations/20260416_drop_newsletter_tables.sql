-- Migration to drop decommissioned newsletter tables
-- Part of newsletter decommissioning task

BEGIN;

-- 1. Drop the tables (CASCADE handles associated triggers and indexes)
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.newsletter_config CASCADE;

-- 2. Remove the permission from manager_permissions table if it exists
-- This is already done in baseline, but for existing DBs we need to drop the column
-- Note: COLUMN removals in Postgres are generally safe if they aren't indexed/referenced
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
                 AND table_name = 'manager_permissions' 
                 AND column_name = 'can_manage_newsletter') THEN
        ALTER TABLE public.manager_permissions DROP COLUMN can_manage_newsletter;
    END IF;
END $$;

COMMIT;

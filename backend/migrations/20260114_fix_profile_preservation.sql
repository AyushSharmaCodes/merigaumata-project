-- Migration: Fix Profile Preservation during Deletion
-- Removes the ON DELETE CASCADE constraint from profiles table to allow 
-- hard-deleting auth users (for re-registration) while keeping anonymized profile data.

BEGIN;

-- 1. Drop the existing CASCADE constraint
-- In Supabase, these are often named 'profiles_id_fkey' or 'profiles_id_fkey1' etc.
-- It's defined as a foreign key on profiles(id) referencing auth.users(id).
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- We intentionally DO NOT re-add the hard foreign key constraint.
-- This allows us to hard-delete from auth.users (freeing up the Google Identity)
-- while keeping the anonymized record in the profiles table for business history.

-- The relationship still exists implicitly via the ID, but it is no longer 
-- enforced by the database, which is exactly what we need for this use case.

COMMIT;

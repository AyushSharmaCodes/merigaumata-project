-- Migration: Add welcome_sent flag to profiles table
-- Ensures welcome emails are only sent once per account lifecycle

BEGIN;

-- 1. Add welcome_sent column
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS welcome_sent BOOLEAN DEFAULT false;

-- 2. Update existing verified users or Google users as having already received it
-- (To prevent spamming existing users on their next login)
UPDATE public.profiles
SET welcome_sent = true
WHERE auth_provider = 'GOOGLE' OR email_verified = true;

COMMENT ON COLUMN profiles.welcome_sent IS 'Flag to track if the initial welcome/registration email has been sent to the user.';

COMMIT;

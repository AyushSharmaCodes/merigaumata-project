-- Migration to fix donation user_id foreign key
-- Drops the old constraint referencing auth.users and adds a new one referencing public.profiles

-- First, identify the constraint name (usually donations_user_id_fkey)
-- and drop it.
ALTER TABLE donations 
DROP CONSTRAINT IF EXISTS donations_user_id_fkey;

-- Add the new constraint referencing public.profiles
ALTER TABLE donations
ADD CONSTRAINT donations_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Fix donation_subscriptions table
ALTER TABLE donation_subscriptions
DROP CONSTRAINT IF EXISTS donation_subscriptions_user_id_fkey;

ALTER TABLE donation_subscriptions
ADD CONSTRAINT donation_subscriptions_user_id_fkey
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Log the change (optional)
COMMENT ON CONSTRAINT donations_user_id_fkey ON donations IS 'Reference profiles(id) instead of auth.users(id)';
COMMENT ON CONSTRAINT donation_subscriptions_user_id_fkey ON donation_subscriptions IS 'Reference profiles(id) instead of auth.users(id)';

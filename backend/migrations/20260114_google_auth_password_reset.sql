-- Migration: Google Auth Email Verification & Password Reset
-- Created: 2026-01-14
-- Description: Add columns for auth provider tracking and password reset functionality

-- ============================================
-- 1. Add auth_provider column
-- ============================================
-- Tracks whether user registered via LOCAL (email/password) or GOOGLE OAuth
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'LOCAL';

-- Add constraint to ensure valid values
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_auth_provider_check'
    ) THEN
        ALTER TABLE profiles
        ADD CONSTRAINT profiles_auth_provider_check 
        CHECK (auth_provider IN ('LOCAL', 'GOOGLE'));
    END IF;
END $$;

COMMENT ON COLUMN profiles.auth_provider IS 'Authentication provider: LOCAL (email/password) or GOOGLE (OAuth)';

-- ============================================
-- 2. Add password reset columns
-- ============================================
-- Token for password reset (one-time use, expires after 1 hour)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS password_reset_token TEXT,
ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN profiles.password_reset_token IS 'Secure token for password reset, one-time use';
COMMENT ON COLUMN profiles.password_reset_expires IS 'Expiry timestamp for password reset token (1 hour from creation)';

-- ============================================
-- 3. Create indexes for token lookups
-- ============================================
-- Index for password reset token (partial index - only non-null values)
CREATE INDEX IF NOT EXISTS idx_profiles_password_reset_token 
ON profiles(password_reset_token) 
WHERE password_reset_token IS NOT NULL;

-- Index for finding Google auth users (partial index)
CREATE INDEX IF NOT EXISTS idx_profiles_google_auth 
ON profiles(auth_provider) 
WHERE auth_provider = 'GOOGLE';

-- ============================================
-- 4. Update existing Google OAuth users
-- ============================================
-- Identify users who signed up via Google OAuth
-- These users have entries in auth.identities with provider = 'google'
-- Note: This requires access to auth schema which may need to be run by admin

-- For now, we'll create a function that can be called to sync auth_provider
-- based on auth.identities table
CREATE OR REPLACE FUNCTION sync_auth_provider_from_identities()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Update profiles where user has a Google identity
    UPDATE profiles p
    SET auth_provider = 'GOOGLE'
    FROM auth.identities i
    WHERE p.id = i.user_id
    AND i.provider = 'google'
    AND p.auth_provider = 'LOCAL';
    
    RAISE NOTICE 'Updated auth_provider for Google OAuth users';
END;
$$;

-- Execute the sync function
SELECT sync_auth_provider_from_identities();

-- Grant execute permission to authenticated users (for admin use)
GRANT EXECUTE ON FUNCTION sync_auth_provider_from_identities() TO authenticated;

COMMENT ON FUNCTION sync_auth_provider_from_identities IS 'Syncs auth_provider column based on auth.identities table';

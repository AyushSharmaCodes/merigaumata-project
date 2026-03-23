-- Migration to add email verification token columns to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS email_verification_token TEXT,
ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;

-- Create index for faster token lookups
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_token 
ON profiles(email_verification_token) 
WHERE email_verification_token IS NOT NULL;

-- Optional: Add a comment
COMMENT ON COLUMN profiles.email_verification_token IS 'Token for email verification, expires after 24 hours';
COMMENT ON COLUMN profiles.email_verification_expires IS 'Expiry timestamp for email verification token';

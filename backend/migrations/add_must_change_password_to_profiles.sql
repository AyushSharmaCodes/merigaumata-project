-- Add must_change_password column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;

-- Force update to false for existing records
UPDATE profiles SET must_change_password = FALSE WHERE must_change_password IS NULL;

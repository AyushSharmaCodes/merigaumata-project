-- Add created_by column to profiles table to track who created the user
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES profiles(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON profiles(created_by);

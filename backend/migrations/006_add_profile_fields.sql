-- Add profile enhancement fields to profiles table
-- These fields support the comprehensive user profile system

-- Add new fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS last_name VARCHAR(100),
ADD COLUMN IF NOT EXISTS gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Create index for deleted users query
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);

-- Update existing profiles: split 'name' into first_name if not already set
-- This helps migrate existing data
UPDATE profiles 
SET first_name = SPLIT_PART(name, ' ', 1),
    last_name = CASE 
        WHEN LENGTH(name) - LENGTH(REPLACE(name, ' ', '')) > 0 
        THEN SUBSTRING(name FROM POSITION(' ' IN name) + 1)
        ELSE NULL
    END
WHERE first_name IS NULL AND name IS NOT NULL;

-- Make first_name NOT NULL after populating
ALTER TABLE profiles 
ALTER COLUMN first_name SET NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN profiles.first_name IS 'User first name (required)';
COMMENT ON COLUMN profiles.last_name IS 'User last name (optional)';
COMMENT ON COLUMN profiles.gender IS 'User gender identity';
COMMENT ON COLUMN profiles.avatar_url IS 'URL to user profile image in Supabase Storage';
COMMENT ON COLUMN profiles.is_deleted IS 'Soft delete flag - preserves data for historical integrity';
COMMENT ON COLUMN profiles.deleted_at IS 'Timestamp when account was deleted';

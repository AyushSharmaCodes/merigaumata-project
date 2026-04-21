-- =============================================================================
-- Migration: 20260419_set_profile_images_bucket_public.sql
-- Purpose: Make the profile-images bucket public so profile avatars are
--          accessible via permanent public URLs (security is maintained via
--          UUID-obfuscated filenames, e.g. userId-randomId.jpg).
-- =============================================================================

-- Ensure the bucket exists first (create if not exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images',
    'profile-images',
    true,  -- PUBLIC bucket
    5242880, -- 5MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
    public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow anyone to SELECT (read) from public profile-images bucket
DROP POLICY IF EXISTS "Public profile images are viewable by everyone" ON storage.objects;
CREATE POLICY "Public profile images are viewable by everyone"
ON storage.objects FOR SELECT
USING ( bucket_id = 'profile-images' );

-- Allow authenticated users to upload their own avatar
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
CREATE POLICY "Users can upload their own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
CREATE POLICY "Users can update their own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
CREATE POLICY "Users can delete their own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow service_role (backend) full access for admin operations
DROP POLICY IF EXISTS "Service role has full access to profile images" ON storage.objects;
CREATE POLICY "Service role has full access to profile images"
ON storage.objects FOR ALL
TO service_role
USING ( bucket_id = 'profile-images' )
WITH CHECK ( bucket_id = 'profile-images' );

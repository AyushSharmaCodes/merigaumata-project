-- Migration: Enhance Return Request Schema and Storage
-- Description: Adds columns for granular return details and configures storage for return images.

-- 1. Add new columns to return_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_items' AND column_name = 'reason') THEN
        ALTER TABLE return_items ADD COLUMN reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_items' AND column_name = 'images') THEN
        ALTER TABLE return_items ADD COLUMN images TEXT[]; -- Array of image URLs
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'return_items' AND column_name = 'condition') THEN
        ALTER TABLE return_items ADD COLUMN condition TEXT;
    END IF;
END $$;

-- 2. Add new columns to returns table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'refund_breakdown') THEN
        ALTER TABLE returns ADD COLUMN refund_breakdown JSONB;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'returns' AND column_name = 'staff_notes') THEN
        ALTER TABLE returns ADD COLUMN staff_notes TEXT;
    END IF;
END $$;

-- 3. Create Storage Bucket for Return Images if it doesn't exist
-- Note: Bucket creation is usually done via API or Dashboard, but we can try to insert into storage.buckets if permissions allow.
-- Ideally, we assume the bucket 'return_images' needs to be created.
-- Since we are in SQL, we can try to insert if not exists.

INSERT INTO storage.buckets (id, name, public)
VALUES ('return_images', 'return_images', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies for 'return_images'

-- Allow Authenticated Users to Upload (INSERT)
-- Path convention: returns/{userId}/{orderId}/{itemId}/{filename}
CREATE POLICY "Users can upload return images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'return_images' AND
    (storage.foldername(name))[1] = 'returns' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

-- Allow Authenticated Users to View (SELECT) their own uploads or public
-- Since we made the bucket public (true), SELECT is generally open for public URLs.
-- But for restrictive access, we can enforce policy if public=false.
-- Here we trust the UUIDs in paths for obfuscation if public, but better to allow read.
CREATE POLICY "Users can view return images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'return_images');

-- Allow Users to Delete their own temporary uploads if needed (optional)
CREATE POLICY "Users can delete own return images"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'return_images' AND
    (storage.foldername(name))[1] = 'returns' AND
    (storage.foldername(name))[2] = auth.uid()::text
);

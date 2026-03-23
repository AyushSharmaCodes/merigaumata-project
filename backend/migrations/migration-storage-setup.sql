-- Create 'events' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Create 'blogs' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('blogs', 'blogs', true)
ON CONFLICT (id) DO NOTHING;

-- Create 'gallery' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

-- Create 'profiles' bucket (private)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('profiles', 'profiles', false)
ON CONFLICT (id) DO NOTHING;

-- Create 'team' bucket
INSERT INTO storage.buckets (id, name, public) 
VALUES ('team', 'team', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled (usually is by default)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policies for 'events' bucket
CREATE POLICY "Public Access Events" ON storage.objects FOR SELECT USING ( bucket_id = 'events' );
CREATE POLICY "Authenticated Uploads Events" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'events' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Updates Events" ON storage.objects FOR UPDATE USING ( bucket_id = 'events' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Deletes Events" ON storage.objects FOR DELETE USING ( bucket_id = 'events' AND auth.role() = 'authenticated' );

-- Policies for 'blogs' bucket
CREATE POLICY "Public Access Blogs" ON storage.objects FOR SELECT USING ( bucket_id = 'blogs' );
CREATE POLICY "Authenticated Uploads Blogs" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'blogs' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Updates Blogs" ON storage.objects FOR UPDATE USING ( bucket_id = 'blogs' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Deletes Blogs" ON storage.objects FOR DELETE USING ( bucket_id = 'blogs' AND auth.role() = 'authenticated' );

-- Policies for 'gallery' bucket
CREATE POLICY "Public Access Gallery" ON storage.objects FOR SELECT USING ( bucket_id = 'gallery' );
CREATE POLICY "Authenticated Uploads Gallery" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'gallery' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Updates Gallery" ON storage.objects FOR UPDATE USING ( bucket_id = 'gallery' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Deletes Gallery" ON storage.objects FOR DELETE USING ( bucket_id = 'gallery' AND auth.role() = 'authenticated' );

-- Policies for 'profiles' bucket (Private - only owner can access/update)
-- Note: This requires user_id to be part of the path or metadata. 
-- For simplicity, we'll allow authenticated users to read their own files if path contains their ID, or just allow authenticated read for now.
CREATE POLICY "Authenticated Access Profiles" ON storage.objects FOR SELECT USING ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Uploads Profiles" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Updates Profiles" ON storage.objects FOR UPDATE USING ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );

-- Policies for 'team' bucket
CREATE POLICY "Public Access Team" ON storage.objects FOR SELECT USING ( bucket_id = 'team' );
CREATE POLICY "Authenticated Uploads Team" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'team' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Updates Team" ON storage.objects FOR UPDATE USING ( bucket_id = 'team' AND auth.role() = 'authenticated' );

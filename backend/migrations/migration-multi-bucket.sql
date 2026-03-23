-- Migration: Setup Multi-Bucket Storage
-- Run this in Supabase SQL Editor

-- 1. Create buckets (Note: SQL creation might be flaky, manual creation recommended if this fails)
-- We try to insert into storage.buckets. If it fails, user must create manually.

-- Events Bucket (Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('events', 'events', true) ON CONFLICT (id) DO NOTHING;

-- Blogs Bucket (Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('blogs', 'blogs', true) ON CONFLICT (id) DO NOTHING;

-- Profiles Bucket (Private)
INSERT INTO storage.buckets (id, name, public) VALUES ('profiles', 'profiles', false) ON CONFLICT (id) DO NOTHING;

-- Gallery Bucket (Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('gallery', 'gallery', true) ON CONFLICT (id) DO NOTHING;

-- Team Bucket (Public)
INSERT INTO storage.buckets (id, name, public) VALUES ('team', 'team', true) ON CONFLICT (id) DO NOTHING;


-- 2. RLS Policies for new buckets

-- Events: Public Read, Auth Insert
CREATE POLICY "Public read events" ON storage.objects FOR SELECT USING (bucket_id = 'events');
CREATE POLICY "Auth insert events" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'events');

-- Blogs: Public Read, Auth Insert
CREATE POLICY "Public read blogs" ON storage.objects FOR SELECT USING (bucket_id = 'blogs');
CREATE POLICY "Auth insert blogs" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'blogs');

-- Gallery: Public Read, Auth Insert
CREATE POLICY "Public read gallery" ON storage.objects FOR SELECT USING (bucket_id = 'gallery');
CREATE POLICY "Auth insert gallery" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'gallery');

-- Team: Public Read, Auth Insert
CREATE POLICY "Public read team" ON storage.objects FOR SELECT USING (bucket_id = 'team');
CREATE POLICY "Auth insert team" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'team');

-- Profiles: Private (Owner Read/Write)
-- Note: Since backend proxies uploads, we might need a policy that allows the service role (which bypasses RLS) or authenticated users.
-- If using service role, RLS is bypassed. If using anon/auth client, we need policies.
-- For now, assuming backend uses service role or we allow auth users to upload their own profile.
-- Policy: User can view their own profile image (or maybe public read if it's a public profile?)
-- User said "user profile image (private)". So only owner can see? Or maybe authenticated users?
-- Usually profile pics are public. But user said private.
-- Let's allow Owner Select and Insert.
CREATE POLICY "Owner read profiles" ON storage.objects FOR SELECT USING (bucket_id = 'profiles' AND auth.uid() = owner);
CREATE POLICY "Owner insert profiles" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'profiles' AND auth.uid() = owner);

-- Update photos table to track bucket
ALTER TABLE photos ADD COLUMN IF NOT EXISTS bucket_name TEXT DEFAULT 'images';

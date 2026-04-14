-- Migration: Storage Buckets Refinement & Hardening
-- This script ensures all required storage buckets exist with standardized policies and size restrictions.

-- 1. Create/Update Buckets with Size Limits (in bytes)
-- Generic Limit: 10MB (10485760 bytes)
-- Profile/Testimonial Limit: 5MB (5242880 bytes)

-- Images Bucket (Products, Carousel)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('images', 'images', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}';

-- Gallery Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('gallery', 'gallery', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}';

-- Events Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('events', 'events', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}';

-- Blogs Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('blogs', 'blogs', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}';

-- Team Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('team', 'team', true, 10485760, '{image/jpeg,image/png,image/webp,image/gif}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,image/gif}';

-- Testimonial User Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('testimonial-user', 'testimonial-user', true, 5242880, '{image/jpeg,image/png,image/webp}') 
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 5242880, allowed_mime_types = '{image/jpeg,image/png,image/webp}';

-- Profiles Bucket (Private)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profiles', 'profiles', false, 5242880, '{image/jpeg,image/png,image/webp}') 
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 5242880, allowed_mime_types = '{image/jpeg,image/png,image/webp}';

-- Return Images Bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('return_images', 'return_images', false, 10485760, '{image/jpeg,image/png,image/webp,application/pdf}') 
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = '{image/jpeg,image/png,image/webp,application/pdf}';

-- Invoices Bucket (Private - Restricted)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('invoices', 'invoices', false, 10485760, '{application/pdf}') 
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = '{application/pdf}';

-- 2. Standardized RLS Policies for Storage.Objects

-- Helper to drop policies if they exist (Postgres 13+ doesn't have IF EXISTS for CREATE POLICY)
-- Usually better to just use DO blocks or drop first.

DO $$ 
BEGIN
    -- Public Buckets: Read access for everyone
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
    CREATE POLICY "Public Access" ON storage.objects FOR SELECT USING (bucket_id IN ('images', 'gallery', 'events', 'blogs', 'team', 'testimonial-user'));

    -- Authenticated Uploads: Managers and Admins can upload to most buckets
    -- Note: This assumes service_role is used by backend, which bypasses RLS.
    -- But for client-side resiliency, we define these.
    DROP POLICY IF EXISTS "Auth Uploads" ON storage.objects;
    CREATE POLICY "Auth Uploads" ON storage.objects FOR INSERT WITH CHECK (auth.role() = 'authenticated');

    -- Private: Profiles (Owner only)
    DROP POLICY IF EXISTS "Owner Profiles Access" ON storage.objects;
    CREATE POLICY "Owner Profiles Access" ON storage.objects FOR SELECT USING (bucket_id = 'profiles' AND auth.uid() = owner);
    
    -- Private: Invoices (System/Admin only - usually service_role)
    -- If we need managers to see them:
    DROP POLICY IF EXISTS "Manager Invoices Read" ON storage.objects;
    CREATE POLICY "Manager Invoices Read" ON storage.objects FOR SELECT USING (bucket_id = 'invoices' AND auth.jwt() ->> 'role' IN ('admin', 'manager'));

END $$;

-- Migration: Secure Invoices Bucket
-- Created: 2026-02-01
-- Description: Makes invoices bucket private and adds storage_path to track Supabase objects

-- 1. Ensure invoices bucket exists and is PRIVATE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('invoices', 'invoices', false, 5242880, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false;

-- 2. Add storage_path to invoices table
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'invoices' AND COLUMN_NAME = 'storage_path') THEN
        ALTER TABLE invoices ADD COLUMN storage_path TEXT;
        COMMENT ON COLUMN invoices.storage_path IS 'Path to the invoice file in the Supabase storage bucket';
    END IF;
END $$;

-- 3. Enable RLS on storage.objects if not already (safeguard)
-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- 4. Policies for 'invoices' bucket
-- Allow service_role to manage all (handled by Supabase automatically usually)
-- For granularity, we can add specific policies, but since we serve through backend API, 
-- we mainly need to ensure it's not public.

-- Remove any existing public access policies for invoices bucket if they exist
-- We do this via a DO block to search pg_policies since storage.policies view might be missing
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND (
            policyname ILIKE '%public%' 
            OR qual ILIKE '%invoices%' 
            OR with_check ILIKE '%invoices%'
          )
    LOOP
        EXECUTE format('DROP POLICY %I ON storage.objects', pol.policyname);
    END LOOP;
END $$;

-- Policy: Authenticated users can read their own invoices (if we were using client-side SDK)
-- However, we use Signed URLs from the backend, so internal policies are less critical 
-- as long as 'public' is false.

-- To be safe, we'll allow the backend (authenticated or service role) to manage them.
-- Most ecommerce setups prefer backend-only access for invoices.

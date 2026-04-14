-- Migration: Redefine Granular Storage Buckets
-- Date: 2026-04-14
-- Description: Creates 11 specific, granular buckets for all business entities with 5MB limits and strict RLS policies.

-- Create Buckets Utility Function (Ensures idempotency)
DO $$
DECLARE
    bucket_list TEXT[] := ARRAY[
        'gallery-media', 
        'product-media', 
        'event-media', 
        'blog-media', 
        'team-media', 
        'testimonial-media', 
        'profile-images', 
        'media-assets',
        'return-request-media',
        'policy-documents',
        'invoice-documents'
    ];
    b TEXT;
    is_public BOOLEAN;
    size_limit BIGINT := 5242880; -- 5MB
BEGIN
    FOREACH b IN ARRAY bucket_list LOOP
        is_public := NOT (b IN ('return-request-media', 'invoice-documents'));
        
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (b, b, is_public, size_limit, 
            CASE 
                WHEN b IN ('policy-documents', 'invoice-documents') THEN 
                    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                ELSE 
                    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
            END
        )
        ON CONFLICT (id) DO UPDATE 
        SET public = EXCLUDED.public,
            file_size_limit = EXCLUDED.file_size_limit,
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    END LOOP;
END $$;

-- ==========================================
-- STORAGE POLICIES (RLS)
-- ==========================================

-- Standard logic: 
-- 1. Everyone can read public buckets.
-- 2. Authenticated users can read their own files in private/semi-private buckets.
-- 3. Admins/Managers can do everything.

-- helper for admin check (Placed in public to avoid storage schema permission issues)
CREATE OR REPLACE FUNCTION public.is_storage_admin_or_manager() 
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = (select auth.uid())
    AND r.name IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply policies to all 11 buckets
DO $$
DECLARE
    bucket_list TEXT[] := ARRAY[
        'gallery-media', 'product-media', 'event-media', 'blog-media', 
        'team-media', 'testimonial-media', 'profile-images', 'media-assets',
        'return-request-media', 'policy-documents', 'invoice-documents'
    ];
    b TEXT;
BEGIN
    FOREACH b IN ARRAY bucket_list LOOP
        -- 1. DROP SPECIFIC GRANULAR POLICIES (if re-running)
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Public Read ' || b);

        -- 2. ADMIN/MANAGER FULL ACCESS (Across all buckets)
        -- (Note: Created once outside the loop or check existence)
        IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin Manage All Objects') THEN
            CREATE POLICY "Admin Manage All Objects" ON storage.objects
            FOR ALL TO authenticated
            USING (public.is_storage_admin_or_manager())
            WITH CHECK (public.is_storage_admin_or_manager());
        END IF;

        -- 3. PUBLIC READ (For public buckets only)
        IF b NOT IN ('return-request-media', 'invoice-documents') THEN
            EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO public USING (bucket_id = %L)', 'Public Read ' || b, b);
        END IF;

        -- 4. USER SPECIFIC ACCESS
        -- profile-images: users can manage their own avatar
        IF b = 'profile-images' THEN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Avatar Management') THEN
                CREATE POLICY "User Avatar Management" ON storage.objects
                FOR ALL TO authenticated
                USING (bucket_id = 'profile-images' AND (select auth.uid())::text = (storage.foldername(name))[1])
                WITH CHECK (bucket_id = 'profile-images' AND (select auth.uid())::text = (storage.foldername(name))[1]);
            END IF;
        END IF;

        -- return-request-media: users can read/upload their own proof
        IF b = 'return-request-media' THEN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Return Proof Management') THEN
                CREATE POLICY "User Return Proof Management" ON storage.objects
                FOR ALL TO authenticated
                USING (bucket_id = 'return-request-media' AND (select auth.uid())::text = (storage.foldername(name))[1])
                WITH CHECK (bucket_id = 'return-request-media' AND (select auth.uid())::text = (storage.foldername(name))[1]);
            END IF;
        END IF;

        -- invoice-documents: users can read their own invoices
        IF b = 'invoice-documents' THEN
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Invoice View') THEN
                CREATE POLICY "User Invoice View" ON storage.objects
                FOR SELECT TO authenticated
                USING (bucket_id = 'invoice-documents' AND (select auth.uid())::text = (storage.foldername(name))[1]);
            END IF;
        END IF;

    END LOOP;
END $$;

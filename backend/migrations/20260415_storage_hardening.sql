-- Storage Configuration Hardening & Consistency fix
-- Date: 2026-04-15
-- Description: Ensures profile-images are private and expands allowed MIME types for compatibility.

DO $$
DECLARE
    bucket_list TEXT[] := ARRAY[
        'gallery-media', 'product-media', 'event-media', 'blog-media',
        'team-media', 'testimonial-media', 'profile-images', 'media-assets',
        'return-request-media', 'policy-documents', 'invoice-documents'
    ];
    b TEXT;
    is_public BOOLEAN;
    size_limit BIGINT := 5242880; -- 5MB
BEGIN
    FOREACH b IN ARRAY bucket_list LOOP
        is_public := NOT (b IN ('return-request-media', 'invoice-documents', 'profile-images'));
        
        -- Update existing buckets OR create if missing
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (b, b, is_public, size_limit,
            CASE
                WHEN b IN ('policy-documents', 'invoice-documents') THEN
                    ARRAY['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                ELSE
                    ARRAY['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp', 'image/gif', 'image/svg+xml']
            END
        )
        ON CONFLICT (id) DO UPDATE
        SET public = EXCLUDED.public, 
            file_size_limit = EXCLUDED.file_size_limit, 
            allowed_mime_types = EXCLUDED.allowed_mime_types;
    END LOOP;
END $$;

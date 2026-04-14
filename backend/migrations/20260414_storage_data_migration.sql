-- Migration: Standardize Storage Bucket URLs (Final Granular Migration)
-- Date: 2026-04-14
-- Description: Updates all existing image URLs in the database to use the 11-bucket granular standard.
--              Handles transformation from BOTH legacy names and the intermediate plural system.

BEGIN;

-- 1. Correct Product Images (TEXT array)
UPDATE public.products
SET images = (
    SELECT array_agg(
        REPLACE(REPLACE(REPLACE(img, '/product_images/', '/product-media/'), '/images/products/', '/product-media/'), '/images/', '/product-media/')
    )
    FROM unnest(images) img
)
WHERE images IS NOT NULL AND array_length(images, 1) > 0;

-- 2. Correct Blog Images
UPDATE public.blogs
SET image = REPLACE(REPLACE(image, '/blog_images/', '/blog-media/'), '/blogs/', '/blog-media/')
WHERE image IS NOT NULL AND (image LIKE '%/blog_images/%' OR image LIKE '%/blogs/%');

-- 3. Correct Event Images
UPDATE public.events
SET image = REPLACE(REPLACE(image, '/event_images/', '/event-media/'), '/events/', '/event-media/')
WHERE image IS NOT NULL AND (image LIKE '%/event_images/%' OR image LIKE '%/events/%');

-- 4. Correct Gallery Folders (Cover Image)
UPDATE public.gallery_folders
SET cover_image = REPLACE(REPLACE(REPLACE(cover_image, '/gallery_uploads/', '/gallery-media/'), '/gallery/', '/gallery-media/'), '/images/carousel/', '/gallery-media/')
WHERE cover_image IS NOT NULL AND (cover_image LIKE '%/gallery_uploads/%' OR cover_image LIKE '%/gallery/%' OR cover_image LIKE '%/images/carousel/%');

-- 5. Correct Gallery Item Images
UPDATE public.gallery_items
SET image_url = REPLACE(REPLACE(REPLACE(image_url, '/gallery_uploads/', '/gallery-media/'), '/gallery/', '/gallery-media/'), '/images/carousel/', '/gallery-media/')
WHERE image_url IS NOT NULL AND (image_url LIKE '%/gallery_uploads/%' OR image_url LIKE '%/gallery/%' OR image_url LIKE '%/images/carousel/%');

-- 6. Correct Testimonial Images
UPDATE public.testimonials
SET image = REPLACE(REPLACE(image, '/testimonial_images/', '/testimonial-media/'), '/testimonial-user/', '/testimonial-media/')
WHERE image IS NOT NULL AND (image LIKE '%/testimonial_images/%' OR image LIKE '%/testimonial-user/%');

-- 7. Correct Profile Avatars
UPDATE public.profiles
SET avatar_url = REPLACE(REPLACE(avatar_url, '/profile_images/', '/profile-images/'), '/profiles/', '/profile-images/')
WHERE avatar_url IS NOT NULL AND (avatar_url LIKE '%/profile_images/%' OR avatar_url LIKE '%/profiles/%');

-- 8. Correct Store Settings (JSONB values)
UPDATE public.store_settings
SET value = to_jsonb(REPLACE(REPLACE(REPLACE(value::text, '/brand_assets/', '/media-assets/'), '/images/', '/media-assets/'), '/product_images/', '/product-media/'))
WHERE key IN ('BRAND_LOGO_URL', 'FAVICON_URL')
AND (value::text LIKE '%/brand_assets/%' OR value::text LIKE '%/images/%' OR value::text LIKE '%/product_images/%');

-- 9. Correct System Switches (JSONB values)
UPDATE public.system_switches
SET value = to_jsonb(REPLACE(REPLACE(value::text, '/brand_assets/', '/media-assets/'), '/images/', '/media-assets/'))
WHERE key = 'BRAND_LOGO_URL'
AND (value::text LIKE '%/brand_assets/%' OR value::text LIKE '%/images/%');

-- 10. Correct Photos Metadata Table (Crucial for Deletion Logic)
-- Map all previous iterations to the final standards
UPDATE public.photos
SET bucket_name = 'gallery-media'
WHERE bucket_name IN ('gallery_uploads', 'gallery', 'carousel_slides');

UPDATE public.photos
SET bucket_name = 'product-media'
WHERE bucket_name IN ('product_images', 'images');

UPDATE public.photos
SET bucket_name = 'event-media'
WHERE bucket_name IN ('event_images', 'events');

UPDATE public.photos
SET bucket_name = 'blog-media'
WHERE bucket_name IN ('blog_images', 'blogs');

UPDATE public.photos
SET bucket_name = 'testimonial-media'
WHERE bucket_name IN ('testimonial_images', 'testimonial-user');

UPDATE public.photos
SET bucket_name = 'profile-images'
WHERE bucket_name IN ('profile_images', 'profiles');

UPDATE public.photos
SET bucket_name = 'team-media'
WHERE bucket_name = 'team';

UPDATE public.photos
SET bucket_name = 'return-request-media'
WHERE bucket_name IN ('return_images', 'returns');

UPDATE public.photos
SET bucket_name = 'invoice-documents'
WHERE bucket_name IN ('invoices');

COMMIT;

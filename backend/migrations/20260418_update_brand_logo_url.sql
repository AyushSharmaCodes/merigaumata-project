-- Recovery Migration to Update Brand Logo URL
-- Goal: Update the BRAND_LOGO_URL in the system_switches table to use the new media-assets bucket and correct project ID.

UPDATE public.system_switches 
SET value = '"https://dtrkrmmmthezztdkgoyz.supabase.co/storage/v1/object/public/media-assets/brand-logo.png"'::jsonb
WHERE key = 'BRAND_LOGO_URL';

-- Verify the update
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.system_switches 
        WHERE key = 'BRAND_LOGO_URL' 
        AND value::text LIKE '%media-assets%'
    ) THEN
        RAISE NOTICE 'BRAND_LOGO_URL successfully updated to media-assets bucket.';
    ELSE
        RAISE WARNING 'BRAND_LOGO_URL might not have been updated correctly.';
    END IF;
END $$;

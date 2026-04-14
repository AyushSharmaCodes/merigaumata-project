-- Migration: 20260414_create_brand_assets_table.sql
-- Purpose: Create a dedicated table for managing brand UI asset URLs (hero images, banners, etc.)
--          so they can be updated in one place and reflected across all pages.

-- 1. Create the table
CREATE TABLE IF NOT EXISTS public.brand_assets (
    key TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;

-- 3. Public read-only access
DROP POLICY IF EXISTS "Public read access to brand_assets" ON public.brand_assets;
CREATE POLICY "Public read access to brand_assets"
    ON public.brand_assets FOR SELECT
    TO anon, authenticated
    USING (true);

-- 4. Service role full access
DROP POLICY IF EXISTS "Service role manages brand_assets" ON public.brand_assets;
CREATE POLICY "Service role manages brand_assets"
    ON public.brand_assets FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 5. Admin access
DROP POLICY IF EXISTS "Admins manage brand_assets" ON public.brand_assets;
CREATE POLICY "Admins manage brand_assets"
    ON public.brand_assets FOR ALL
    TO authenticated
    USING ((auth.jwt() ->> 'role') = 'admin')
    WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

-- 6. Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_brand_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS brand_assets_updated_at ON public.brand_assets;
CREATE TRIGGER brand_assets_updated_at
    BEFORE UPDATE ON public.brand_assets
    FOR EACH ROW
    EXECUTE FUNCTION public.update_brand_assets_updated_at();

-- 7. Seed initial hero image assets (using media-assets bucket)
INSERT INTO public.brand_assets (key, url, description)
VALUES
    ('CONTACT_HERO',  'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/contact-hero.jpg',  'Hero background image for the Contact page.'),
    ('ABOUT_HERO',    'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/about-hero.jpg',    'Hero/story visual image for the About page.'),
    ('FAQ_HERO',      'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/faq-hero.jpg',      'Hero background image for the FAQ page.')
ON CONFLICT (key) DO NOTHING;

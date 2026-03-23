-- Migration to add i18n support for all blog fields
-- Added on: 2026-02-15

-- Add i18n columns to blogs table
ALTER TABLE public.blogs 
ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS excerpt_i18n JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS author_i18n JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tags_i18n JSONB DEFAULT '{}';

-- Create GIN index on tags_i18n for performance if we eventually search by tags
CREATE INDEX IF NOT EXISTS idx_blogs_tags_i18n ON public.blogs USING GIN(tags_i18n);

-- Populate i18n columns with existing data (as 'en' default)
DO $$
BEGIN
    UPDATE public.blogs 
    SET 
        title_i18n = jsonb_build_object('en', title),
        excerpt_i18n = jsonb_build_object('en', excerpt),
        content_i18n = jsonb_build_object('en', content),
        author_i18n = jsonb_build_object('en', author),
        tags_i18n = jsonb_build_object('en', tags)
    WHERE title_i18n = '{}' OR title_i18n IS NULL;
END $$;

-- Update RLS policies (optional, but good to ensure consistency)
-- No changes needed to RLS as they already allow authenticated users full access
-- and public access to published blogs.

COMMENT ON COLUMN public.blogs.title_i18n IS 'Localized titles in JSONB format {lang: text}';
COMMENT ON COLUMN public.blogs.excerpt_i18n IS 'Localized excerpts in JSONB format {lang: text}';
COMMENT ON COLUMN public.blogs.content_i18n IS 'Localized content in JSONB format {lang: text}';
COMMENT ON COLUMN public.blogs.author_i18n IS 'Localized author names in JSONB format {lang: text}';
COMMENT ON COLUMN public.blogs.tags_i18n IS 'Localized tags in JSONB format {lang: text[]}';

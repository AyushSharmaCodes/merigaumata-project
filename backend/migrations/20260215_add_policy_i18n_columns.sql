-- Add i18n JSONB columns to policy_pages table for multi-language support
-- This allows storing all 4 languages (en, hi, ta, te) in a single record

-- Add title_i18n column
ALTER TABLE public.policy_pages 
ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;

-- Add content_html_i18n column
ALTER TABLE public.policy_pages 
ADD COLUMN IF NOT EXISTS content_html_i18n JSONB DEFAULT '{}'::jsonb;

-- Backfill existing records: copy current title and content_html to English (en) in i18n fields
UPDATE public.policy_pages
SET 
    title_i18n = jsonb_build_object('en', title),
    content_html_i18n = jsonb_build_object('en', content_html)
WHERE title_i18n = '{}'::jsonb OR content_html_i18n = '{}'::jsonb;

-- Add comment to columns
COMMENT ON COLUMN public.policy_pages.title_i18n IS 'Multi-language titles stored as JSONB: {en: "...", hi: "...", ta: "...", te: "..."}';
COMMENT ON COLUMN public.policy_pages.content_html_i18n IS 'Multi-language HTML content stored as JSONB: {en: "...", hi: "...", ta: "...", te: "..."}';

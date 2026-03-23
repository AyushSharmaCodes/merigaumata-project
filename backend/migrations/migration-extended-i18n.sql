-- Migration: Add i18n support to FAQs and Policies

BEGIN;

-- 1. FAQs
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS question_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE faqs ADD COLUMN IF NOT EXISTS answer_i18n JSONB DEFAULT '{}'::jsonb;
-- Initialize with existing data (default 'en')
UPDATE faqs SET question_i18n = jsonb_build_object('en', question) WHERE question_i18n = '{}'::jsonb AND question IS NOT NULL;
UPDATE faqs SET answer_i18n = jsonb_build_object('en', answer) WHERE answer_i18n = '{}'::jsonb AND answer IS NOT NULL;

-- 2. Policy Pages
-- Note: Policies are slightly different. We might want to store the HTML content itself localized.
ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE policy_pages ADD COLUMN IF NOT EXISTS content_html_i18n JSONB DEFAULT '{}'::jsonb;

-- Initialize with existing data
UPDATE policy_pages SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE policy_pages SET content_html_i18n = jsonb_build_object('en', content_html) WHERE content_html_i18n = '{}'::jsonb AND content_html IS NOT NULL;

COMMIT;

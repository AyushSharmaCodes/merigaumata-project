-- Recovery Migration: Sync i18n support for About and Contact tables
-- Purpose: Add missing _i18n columns to existing tables and populate English defaults
-- Date: 2026-04-18

BEGIN;

-- 1. About Cards
ALTER TABLE public.about_cards ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_cards ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_cards SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE public.about_cards SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;

-- 2. About Impact Stats
ALTER TABLE public.about_impact_stats ADD COLUMN IF NOT EXISTS label_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_impact_stats SET label_i18n = jsonb_build_object('en', label) WHERE label_i18n = '{}'::jsonb AND label IS NOT NULL;

-- 3. About Timeline
ALTER TABLE public.about_timeline ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_timeline ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_timeline ADD COLUMN IF NOT EXISTS month_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_timeline SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE public.about_timeline SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;
UPDATE public.about_timeline SET month_i18n = jsonb_build_object('en', month) WHERE month_i18n = '{}'::jsonb AND month IS NOT NULL;

-- 4. About Team Members
ALTER TABLE public.about_team_members ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_team_members ADD COLUMN IF NOT EXISTS role_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_team_members ADD COLUMN IF NOT EXISTS bio_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_team_members SET name_i18n = jsonb_build_object('en', name) WHERE name_i18n = '{}'::jsonb AND name IS NOT NULL;
UPDATE public.about_team_members SET role_i18n = jsonb_build_object('en', role) WHERE role_i18n = '{}'::jsonb AND role IS NOT NULL;
UPDATE public.about_team_members SET bio_i18n = jsonb_build_object('en', bio) WHERE bio_i18n = '{}'::jsonb AND bio IS NOT NULL;

-- 5. About Future Goals
ALTER TABLE public.about_future_goals ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.about_future_goals ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_future_goals SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE public.about_future_goals SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;

-- 6. About Settings
ALTER TABLE public.about_settings ADD COLUMN IF NOT EXISTS footer_description_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.about_settings SET footer_description_i18n = jsonb_build_object('en', footer_description) WHERE footer_description_i18n = '{}'::jsonb AND footer_description IS NOT NULL;

-- 7. Contact Info
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS address_line1_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS address_line2_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS city_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS state_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.contact_info ADD COLUMN IF NOT EXISTS country_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.contact_info SET address_line1_i18n = jsonb_build_object('en', address_line1) WHERE address_line1_i18n = '{}'::jsonb AND address_line1 IS NOT NULL;
UPDATE public.contact_info SET address_line2_i18n = jsonb_build_object('en', address_line2) WHERE address_line2_i18n = '{}'::jsonb AND address_line2 IS NOT NULL;
UPDATE public.contact_info SET city_i18n = jsonb_build_object('en', city) WHERE city_i18n = '{}'::jsonb AND city IS NOT NULL;
UPDATE public.contact_info SET state_i18n = jsonb_build_object('en', state) WHERE state_i18n = '{}'::jsonb AND state IS NOT NULL;
UPDATE public.contact_info SET country_i18n = jsonb_build_object('en', country) WHERE country_i18n = '{}'::jsonb AND country IS NOT NULL;

-- 8. Contact Emails
ALTER TABLE public.contact_emails ADD COLUMN IF NOT EXISTS label_i18n JSONB DEFAULT '{}'::jsonb;
UPDATE public.contact_emails SET label_i18n = jsonb_build_object('en', label) WHERE label_i18n = '{}'::jsonb AND label IS NOT NULL;

COMMIT;

-- Migration: Add i18n support to gallery tables

BEGIN;

-- 1. Add i18n columns to gallery_folders
ALTER TABLE gallery_folders ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE gallery_folders ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- Initialize i18n data from existing columns
UPDATE gallery_folders SET name_i18n = jsonb_build_object('en', name) WHERE name_i18n = '{}'::jsonb;
UPDATE gallery_folders SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;

-- 2. Add i18n columns to gallery_items
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE gallery_items ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- Initialize i18n data from existing columns
UPDATE gallery_items SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE gallery_items SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;

-- 3. Add i18n columns to gallery_videos
ALTER TABLE gallery_videos ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE gallery_videos ADD COLUMN IF NOT EXISTS description_i18n JSONB DEFAULT '{}'::jsonb;

-- Initialize i18n data from existing columns
UPDATE gallery_videos SET title_i18n = jsonb_build_object('en', title) WHERE title_i18n = '{}'::jsonb AND title IS NOT NULL;
UPDATE gallery_videos SET description_i18n = jsonb_build_object('en', description) WHERE description_i18n = '{}'::jsonb AND description IS NOT NULL;

COMMIT;

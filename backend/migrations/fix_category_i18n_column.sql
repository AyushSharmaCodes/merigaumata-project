-- Migration: Rename display_name_i18n to name_i18n in categories table
-- Fixes inconsistency between code (expecting name_i18n) and DB (having display_name_i18n)
-- Run this in Supabase SQL Editor

BEGIN;

DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'display_name_i18n') THEN
    ALTER TABLE categories RENAME COLUMN display_name_i18n TO name_i18n;
  ELSIF NOT EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'categories' AND column_name = 'name_i18n') THEN
    -- If neither exists, add name_i18n
    ALTER TABLE categories ADD COLUMN name_i18n JSONB DEFAULT '{}';
    -- Backfill from name
    UPDATE categories SET name_i18n = jsonb_build_object('en', name);
  END IF;
END $$;

COMMIT;

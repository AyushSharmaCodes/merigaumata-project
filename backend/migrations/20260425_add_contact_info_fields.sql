-- Migration: Add missing columns to contact_info
-- Date: 2026-04-25

ALTER TABLE public.contact_info 
ADD COLUMN IF NOT EXISTS google_place_id TEXT,
ADD COLUMN IF NOT EXISTS address_line1_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS address_line2_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS city_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS state_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS country_i18n JSONB DEFAULT '{}'::jsonb;

-- Update updated_at for the record if it exists
UPDATE public.contact_info SET updated_at = NOW() WHERE id IS NOT NULL;

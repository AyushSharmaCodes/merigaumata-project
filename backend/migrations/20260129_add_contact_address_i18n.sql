-- Add i18n columns to contact_info table for address localization
ALTER TABLE contact_info 
ADD COLUMN IF NOT EXISTS address_line1_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS address_line2_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS city_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS state_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS country_i18n JSONB DEFAULT '{}'::jsonb;

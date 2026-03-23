-- Add i18n columns to testimonials table
ALTER TABLE testimonials
ADD COLUMN IF NOT EXISTS name_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS role_i18n JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS content_i18n JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN testimonials.name_i18n IS 'Localized names (e.g., {"hi": "...", "ta": "..."})';
COMMENT ON COLUMN testimonials.role_i18n IS 'Localized roles';
COMMENT ON COLUMN testimonials.content_i18n IS 'Localized content';

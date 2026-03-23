-- Add tags_i18n column to products table for localized tags
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS tags_i18n JSONB DEFAULT '{}'::jsonb;

-- Comment on column
COMMENT ON COLUMN products.tags_i18n IS 'Localized tags. Structure: {"hi": ["tag1", "tag2"], "ta": [...]}';

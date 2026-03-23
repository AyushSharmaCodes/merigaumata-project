-- Migration: Refactor gallery_folders to use category_id instead of folder_type
-- This enables unified category management via the categories table

BEGIN;

-- 1. Add category_id column
ALTER TABLE gallery_folders ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_gallery_folders_category ON gallery_folders(category_id);

-- 3. Migrate data from folder_type to category_id
-- We assume categories with names like 'Festivals', 'Ceremonies', 'General' exist for type='gallery'
-- If they don't, we'll map to 'General' or NULL

-- Use the existing name mapping to find IDs
UPDATE gallery_folders
SET category_id = (
    SELECT id FROM categories 
    WHERE categories.name = 'Festivals' AND categories.type = 'gallery'
)
WHERE folder_type = 'event';

UPDATE gallery_folders
SET category_id = (
    SELECT id FROM categories 
    WHERE categories.name = 'General' AND categories.type = 'gallery'
)
WHERE folder_type = 'general' OR folder_type = 'place';

-- If still NULL, try to find any 'General' gallery category
UPDATE gallery_folders
SET category_id = (
    SELECT id FROM categories 
    WHERE categories.name = 'General' AND categories.type = 'gallery'
    LIMIT 1
)
WHERE category_id IS NULL;

-- 4. Move folder_type to a temporary column or just drop it after verification
-- For safety, we keep it but it's no longer used by the application logic
-- ALTER TABLE gallery_folders DROP COLUMN folder_type;

COMMIT;

-- Add is_home_carousel column to gallery_folders table
ALTER TABLE gallery_folders 
ADD COLUMN IF NOT EXISTS is_home_carousel BOOLEAN DEFAULT false;

-- Create a unique index to ensure only one folder can be the home carousel
-- We use a partial unique index where is_home_carousel is true
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_folders_home_carousel 
ON gallery_folders (is_home_carousel) 
WHERE is_home_carousel = true;

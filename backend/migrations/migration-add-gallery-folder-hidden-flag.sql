-- Add is_hidden column to gallery_folders table
ALTER TABLE gallery_folders 
ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN DEFAULT false;

-- Add index for is_hidden to optimize filtering
CREATE INDEX IF NOT EXISTS idx_gallery_folders_hidden ON gallery_folders(is_hidden);

COMMENT ON COLUMN gallery_folders.is_hidden IS 'Whether the folder should be hidden from the public gallery page';

-- Create gallery_folders table for organizing gallery items
CREATE TABLE IF NOT EXISTS gallery_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    slug TEXT UNIQUE NOT NULL,
    folder_type TEXT CHECK (folder_type IN ('event', 'place', 'general')),
    cover_image TEXT,
    order_index INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gallery_folders_slug ON gallery_folders(slug);
CREATE INDEX IF NOT EXISTS idx_gallery_folders_type ON gallery_folders(folder_type);
CREATE INDEX IF NOT EXISTS idx_gallery_folders_active ON gallery_folders(is_active);
CREATE INDEX IF NOT EXISTS idx_gallery_folders_order ON gallery_folders(order_index);

-- Enable Row Level Security
ALTER TABLE gallery_folders ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read active folders
CREATE POLICY "Public can view active folders" 
    ON gallery_folders 
    FOR SELECT 
    USING (is_active = true);

-- Policy: Service role can manage all folders (admin)
CREATE POLICY "Service role can manage folders" 
    ON gallery_folders 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gallery_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER gallery_folders_updated_at
    BEFORE UPDATE ON gallery_folders
    FOR EACH ROW
    EXECUTE FUNCTION update_gallery_folders_updated_at();

COMMENT ON TABLE gallery_folders IS 'Folders for organizing gallery images and videos by category (events, places, etc)';
COMMENT ON COLUMN gallery_folders.folder_type IS 'Type of folder: event, place, or general';
COMMENT ON COLUMN gallery_folders.slug IS 'URL-friendly identifier for folder';
COMMENT ON COLUMN gallery_folders.cover_image IS 'URL to folder cover/thumbnail image';
COMMENT ON COLUMN gallery_folders.order_index IS 'Display order (lower numbers first)';

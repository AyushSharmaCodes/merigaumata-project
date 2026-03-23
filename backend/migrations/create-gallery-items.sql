-- Create gallery_items table for storing gallery images
CREATE TABLE IF NOT EXISTS gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES gallery_folders(id) ON DELETE CASCADE,
    photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    image_url TEXT NOT NULL,
    thumbnail_url TEXT,
    order_index INTEGER DEFAULT 0,
    captured_date DATE,
    location TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gallery_items_folder ON gallery_items(folder_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_photo ON gallery_items(photo_id);
CREATE INDEX IF NOT EXISTS idx_gallery_items_order ON gallery_items(order_index);
CREATE INDEX IF NOT EXISTS idx_gallery_items_date ON gallery_items(captured_date DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_items_tags ON gallery_items USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read items from active folders
CREATE POLICY "Public can view items from active folders" 
    ON gallery_items 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM gallery_folders 
            WHERE gallery_folders.id = gallery_items.folder_id 
            AND gallery_folders.is_active = true
        )
    );

-- Policy: Service role can manage all items (admin)
CREATE POLICY "Service role can manage items" 
    ON gallery_items 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gallery_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER gallery_items_updated_at
    BEFORE UPDATE ON gallery_items
    FOR EACH ROW
    EXECUTE FUNCTION update_gallery_items_updated_at();

COMMENT ON TABLE gallery_items IS 'Gallery images organized in folders';
COMMENT ON COLUMN gallery_items.folder_id IS 'Reference to parent folder';
COMMENT ON COLUMN gallery_items.photo_id IS 'Reference to photos table for metadata';
COMMENT ON COLUMN gallery_items.image_url IS 'Full-size image URL from Supabase Storage';
COMMENT ON COLUMN gallery_items.thumbnail_url IS 'Thumbnail image URL';
COMMENT ON COLUMN gallery_items.captured_date IS 'Date when photo was taken';
COMMENT ON COLUMN gallery_items.tags IS 'Array of tags for search/filtering';

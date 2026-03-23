-- Create gallery_videos table for YouTube video embeds
CREATE TABLE IF NOT EXISTS gallery_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES gallery_folders(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    youtube_url TEXT NOT NULL,
    youtube_id TEXT NOT NULL,
    thumbnail_url TEXT,
    order_index INTEGER DEFAULT 0,
    duration TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gallery_videos_folder ON gallery_videos(folder_id);
CREATE INDEX IF NOT EXISTS idx_gallery_videos_order ON gallery_videos(order_index);
CREATE INDEX IF NOT EXISTS idx_gallery_videos_youtube_id ON gallery_videos(youtube_id);
CREATE INDEX IF NOT EXISTS idx_gallery_videos_tags ON gallery_videos USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE gallery_videos ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read videos from active folders
CREATE POLICY "Public can view videos from active folders" 
    ON gallery_videos 
    FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM gallery_folders 
            WHERE gallery_folders.id = gallery_videos.folder_id 
            AND gallery_folders.is_active = true
        )
    );

-- Policy: Service role can manage all videos (admin)
CREATE POLICY "Service role can manage videos" 
    ON gallery_videos 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gallery_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER gallery_videos_updated_at
    BEFORE UPDATE ON gallery_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_gallery_videos_updated_at();

COMMENT ON TABLE gallery_videos IS 'YouTube video embeds organized in folders';
COMMENT ON COLUMN gallery_videos.youtube_url IS 'Original YouTube URL';
COMMENT ON COLUMN gallery_videos.youtube_id IS 'Extracted YouTube video ID';
COMMENT ON COLUMN gallery_videos.thumbnail_url IS 'YouTube thumbnail URL';
COMMENT ON COLUMN gallery_videos.duration IS 'Video duration (e.g., "5:30")';
COMMENT ON COLUMN gallery_videos.tags IS 'Array of tags for search/filtering';

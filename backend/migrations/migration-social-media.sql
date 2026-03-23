-- Social Media Management Migration

-- Create social_media table
CREATE TABLE IF NOT EXISTS social_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL, -- e.g., 'facebook', 'instagram', 'twitter', 'youtube', 'linkedin', 'whatsapp', 'telegram', 'other'
    url TEXT NOT NULL,
    icon TEXT, -- Optional: specific icon identifier if needed, though platform usually suffices
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster ordering and filtering
CREATE INDEX IF NOT EXISTS idx_social_media_display_order ON social_media(display_order);
CREATE INDEX IF NOT EXISTS idx_social_media_is_active ON social_media(is_active);

-- Enable Row Level Security (RLS)
ALTER TABLE social_media ENABLE ROW LEVEL SECURITY;

-- Policy: Public can view active social media links
DROP POLICY IF EXISTS "Public can view active social media" ON social_media;
CREATE POLICY "Public can view active social media" 
    ON social_media 
    FOR SELECT 
    USING (is_active = true);

-- Policy: Service role (admin) can manage all social media links
DROP POLICY IF EXISTS "Service role can manage social media" ON social_media;
CREATE POLICY "Service role can manage social media" 
    ON social_media 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Trigger to automatically update updated_at
CREATE OR REPLACE FUNCTION update_social_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS social_media_updated_at ON social_media;
CREATE TRIGGER social_media_updated_at
    BEFORE UPDATE ON social_media
    FOR EACH ROW
    EXECUTE FUNCTION update_social_media_updated_at();

-- Insert default social media links (if table is empty)
INSERT INTO social_media (platform, url, display_order)
SELECT 'facebook', 'https://facebook.com', 1
WHERE NOT EXISTS (SELECT 1 FROM social_media);

INSERT INTO social_media (platform, url, display_order)
SELECT 'instagram', 'https://instagram.com', 2
WHERE NOT EXISTS (SELECT 1 FROM social_media);

INSERT INTO social_media (platform, url, display_order)
SELECT 'twitter', 'https://twitter.com', 3
WHERE NOT EXISTS (SELECT 1 FROM social_media);

INSERT INTO social_media (platform, url, display_order)
SELECT 'youtube', 'https://youtube.com', 4
WHERE NOT EXISTS (SELECT 1 FROM social_media);

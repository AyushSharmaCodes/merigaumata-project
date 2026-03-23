-- Create Photos Table if it doesn't exist
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_path TEXT NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'images',
    title TEXT,
    size BIGINT,
    mime_type TEXT,
    user_id UUID, -- Optional, link to auth.users if needed
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add bucket_name column if it doesn't exist (for existing table)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'photos' AND column_name = 'bucket_name') THEN 
        ALTER TABLE photos ADD COLUMN bucket_name TEXT NOT NULL DEFAULT 'images'; 
    END IF; 
END $$;

-- Enable RLS
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public Access Photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Authenticated Uploads Photos" ON photos FOR INSERT WITH CHECK (true); -- Allow all inserts for now, or restrict to authenticated
CREATE POLICY "Authenticated Deletes Photos" ON photos FOR DELETE USING (true);

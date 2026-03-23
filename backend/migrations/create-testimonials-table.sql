-- Create testimonials table with user relationship
CREATE TABLE IF NOT EXISTS testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    content TEXT NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    image TEXT,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_testimonials_user_id ON testimonials(user_id);

-- Create index on approved for filtering
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(approved);

-- Create index on created_at for ordering
CREATE INDEX IF NOT EXISTS idx_testimonials_created_at ON testimonials(created_at DESC);

-- Enable Row Level Security
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anyone to read approved testimonials
CREATE POLICY "Public can view approved testimonials" 
    ON testimonials 
    FOR SELECT 
    USING (approved = true);

-- Policy: Users can view their own testimonials (approved or not)
CREATE POLICY "Users can view their own testimonials" 
    ON testimonials 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Authenticated users can insert their own testimonials
CREATE POLICY "Authenticated users can create testimonials" 
    ON testimonials 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own testimonials
CREATE POLICY "Users can update their own testimonials" 
    ON testimonials 
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own testimonials
CREATE POLICY "Users can delete their own testimonials" 
    ON testimonials 
    FOR DELETE 
    USING (auth.uid() = user_id);

-- Policy: Allow admins to manage all testimonials (approve, edit, delete)
-- Note: You'll need to create a separate admin check function or use service role key
CREATE POLICY "Service role can manage all testimonials" 
    ON testimonials 
    FOR ALL 
    USING (true)
    WITH CHECK (true);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER testimonials_updated_at
    BEFORE UPDATE ON testimonials
    FOR EACH ROW
    EXECUTE FUNCTION update_testimonials_updated_at();

-- Optional: Create a view for public testimonials (approved only)
CREATE OR REPLACE VIEW public_testimonials AS
SELECT 
    id,
    name,
    role,
    content,
    rating,
    image,
    created_at
FROM testimonials
WHERE approved = true
ORDER BY created_at DESC;

COMMENT ON TABLE testimonials IS 'User testimonials and reviews';
COMMENT ON COLUMN testimonials.user_id IS 'Foreign key to auth.users - links testimonial to user who wrote it';
COMMENT ON COLUMN testimonials.approved IS 'Admin approval flag - only approved testimonials show publicly';
COMMENT ON COLUMN testimonials.name IS 'Display name for the testimonial (can differ from user profile name)';
COMMENT ON COLUMN testimonials.email IS 'Contact email (optional)';
COMMENT ON COLUMN testimonials.role IS 'User role/title (e.g., "Customer", "Community Member")';
COMMENT ON COLUMN testimonials.content IS 'Testimonial text content';
COMMENT ON COLUMN testimonials.rating IS 'Star rating from 1-5';
COMMENT ON COLUMN testimonials.image IS 'URL to user profile image for testimonial';

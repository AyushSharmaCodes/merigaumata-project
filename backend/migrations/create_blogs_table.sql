-- Create blogs table
CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    image TEXT,
    tags TEXT[] DEFAULT '{}',
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on published and date for faster queries
CREATE INDEX IF NOT EXISTS idx_blogs_published_date ON public.blogs(published, date DESC);

-- Create index on tags for filtering
CREATE INDEX IF NOT EXISTS idx_blogs_tags ON public.blogs USING GIN(tags);

-- Enable Row Level Security
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public read access to published blogs
CREATE POLICY "Public can view published blogs"
    ON public.blogs
    FOR SELECT
    USING (published = true);

-- Create policy to allow authenticated users to manage all blogs
CREATE POLICY "Authenticated users can manage blogs"
    ON public.blogs
    FOR ALL
    USING (auth.role() = 'authenticated');

-- Add comment
COMMENT ON TABLE public.blogs IS 'Stores blog posts with content, metadata, and publishing status';

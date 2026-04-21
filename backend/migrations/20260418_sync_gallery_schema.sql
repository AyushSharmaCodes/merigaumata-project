-- Recovery Migration to Sync Gallery Tables Schema
-- Adds missing columns required by gallery folder, item, and video routes

-- 1. Gallery Folders
ALTER TABLE public.gallery_folders ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.gallery_folders ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
ALTER TABLE public.gallery_folders ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

-- 2. Gallery Items
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 3. Gallery Videos
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS youtube_id TEXT;
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Update comments for clarity
COMMENT ON COLUMN public.gallery_folders.slug IS 'URL-friendly name for the folder';
COMMENT ON COLUMN public.gallery_items.thumbnail_url IS 'Optimized small version of the image';
COMMENT ON COLUMN public.gallery_videos.youtube_id IS 'Extracted YouTube video ID';

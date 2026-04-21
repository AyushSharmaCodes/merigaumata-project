-- Migration: Add missing columns to gallery tables
-- Date: 2026-04-19
-- Description: Adds missing columns to gallery_items and gallery_videos to match frontend requirements and fix crashes.

BEGIN;

-- 1. Update gallery_items
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS photo_id UUID REFERENCES public.photos(id) ON DELETE SET NULL;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS captured_date DATE;
ALTER TABLE public.gallery_items ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 2. Update gallery_videos
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS youtube_url TEXT;
ALTER TABLE public.gallery_videos ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.gallery_videos ALTER COLUMN video_url DROP NOT NULL;

-- 3. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_gallery_items_tags ON public.gallery_items USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_gallery_items_date ON public.gallery_items(captured_date DESC);
CREATE INDEX IF NOT EXISTS idx_gallery_videos_tags ON public.gallery_videos USING GIN(tags);

COMMIT;

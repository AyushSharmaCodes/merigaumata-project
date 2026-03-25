-- Create or repair the carousel_slides table so it matches the current app.
-- The app expects image_url at the DB layer and optional i18n fields.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.carousel_slides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    image_url TEXT NOT NULL,
    title TEXT,
    subtitle TEXT,
    title_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    subtitle_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'carousel_slides'
          AND column_name = 'image'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'carousel_slides'
          AND column_name = 'image_url'
    ) THEN
        EXECUTE 'ALTER TABLE public.carousel_slides RENAME COLUMN image TO image_url';
    END IF;
END $$;

ALTER TABLE public.carousel_slides
    ADD COLUMN IF NOT EXISTS image_url TEXT,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS subtitle TEXT,
    ADD COLUMN IF NOT EXISTS title_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS subtitle_i18n JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.carousel_slides
SET image_url = COALESCE(image_url, '')
WHERE image_url IS NULL;

ALTER TABLE public.carousel_slides
    ALTER COLUMN image_url SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_carousel_slides_active_order
ON public.carousel_slides(is_active, order_index);

ALTER TABLE public.carousel_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active carousel slides" ON public.carousel_slides;
CREATE POLICY "Public can view active carousel slides"
ON public.carousel_slides
FOR SELECT
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Authenticated users can manage carousel slides" ON public.carousel_slides;
CREATE POLICY "Authenticated users can manage carousel slides"
ON public.carousel_slides
FOR ALL
USING (auth.role() = 'authenticated')
WITH CHECK (auth.role() = 'authenticated');

DROP TRIGGER IF EXISTS update_carousel_slides_updated_at ON public.carousel_slides;
CREATE TRIGGER update_carousel_slides_updated_at
    BEFORE UPDATE ON public.carousel_slides
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE public.carousel_slides IS 'Homepage hero carousel slides.';
COMMENT ON COLUMN public.carousel_slides.image_url IS 'Public image URL used by the homepage carousel.';

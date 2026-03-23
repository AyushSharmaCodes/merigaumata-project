-- Add i18n columns to carousel_slides table
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'carousel_slides') THEN
    ALTER TABLE carousel_slides 
    ADD COLUMN IF NOT EXISTS title_i18n JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS subtitle_i18n JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

BEGIN;

ALTER TABLE IF EXISTS public.photos
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS bucket_name TEXT NOT NULL DEFAULT 'images',
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS size BIGINT,
    ADD COLUMN IF NOT EXISTS mime_type TEXT;

ALTER TABLE IF EXISTS public.photos
    DROP CONSTRAINT IF EXISTS photos_user_id_fkey;

ALTER TABLE IF EXISTS public.photos
    ADD CONSTRAINT photos_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.photos
    DROP CONSTRAINT IF EXISTS photos_created_by_fkey;

ALTER TABLE IF EXISTS public.photos
    ADD CONSTRAINT photos_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT photos_user_id_fkey ON public.photos IS 'Reference profiles(id) for legacy photo owner field';
COMMENT ON CONSTRAINT photos_created_by_fkey ON public.photos IS 'Reference profiles(id) for normalized photo creator field';

COMMIT;

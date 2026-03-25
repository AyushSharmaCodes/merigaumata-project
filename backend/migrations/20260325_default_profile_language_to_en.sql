BEGIN;

ALTER TABLE public.profiles
    ALTER COLUMN preferred_language SET DEFAULT 'en';

UPDATE public.profiles
SET preferred_language = 'en'
WHERE preferred_language IS NULL
   OR trim(preferred_language) = '';

COMMIT;

BEGIN;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_preferred_language_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_preferred_language_check
    CHECK (preferred_language IN ('en', 'hi', 'ta', 'te'));

COMMIT;

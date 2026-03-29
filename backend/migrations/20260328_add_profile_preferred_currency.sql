ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'INR';

UPDATE public.profiles
SET preferred_currency = 'INR'
WHERE preferred_currency IS NULL
   OR trim(preferred_currency) = '';

ALTER TABLE public.profiles
ALTER COLUMN preferred_currency SET DEFAULT 'INR';

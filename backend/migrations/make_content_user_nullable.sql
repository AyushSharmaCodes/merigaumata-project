-- Make Public Content User Column Nullable
-- This migration allows anonymization (user_id = NULL) for comments, reviews, etc.
-- to preserve content while deleting the user account.

BEGIN;

    -- 1. Comments: Make user_id nullable and update FK to SET NULL
    ALTER TABLE IF EXISTS public.comments ALTER COLUMN user_id DROP NOT NULL;
    
    -- Drop existing FK if it exists (cascade or regular)
    -- Try blindly dropping common names or handling via DO block not ideal inside transaction for some versions,
    -- but usually safe to Drop IF EXISTS constraints.
    ALTER TABLE IF EXISTS public.comments DROP CONSTRAINT IF EXISTS comments_user_id_fkey;
    
    -- Re-add as SET NULL
    ALTER TABLE IF EXISTS public.comments
    ADD CONSTRAINT comments_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;


    -- 2. Reviews: Make user_id nullable and update FK to SET NULL
    ALTER TABLE IF EXISTS public.reviews ALTER COLUMN user_id DROP NOT NULL;

    ALTER TABLE IF EXISTS public.reviews DROP CONSTRAINT IF EXISTS reviews_user_id_fkey;

    -- Re-add as SET NULL (referencing auth.users or profiles? Check valid ref)
    -- Reviews usually reference auth.users in this schema based on previous checks
    ALTER TABLE IF EXISTS public.reviews
    ADD CONSTRAINT reviews_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;


    -- 3. Testimonials: Ensure it's nullable (just in case) and SET NULL
    ALTER TABLE IF EXISTS public.testimonials ALTER COLUMN user_id DROP NOT NULL;

    ALTER TABLE IF EXISTS public.testimonials DROP CONSTRAINT IF EXISTS testimonials_user_id_fkey;

    ALTER TABLE IF EXISTS public.testimonials
    ADD CONSTRAINT testimonials_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;


    -- 4. Event Registrations: Ensure SET NULL
    -- (already nullable based on checks, but fixing FK action is good safety)
    ALTER TABLE IF EXISTS public.event_registrations DROP CONSTRAINT IF EXISTS event_registrations_user_id_fkey;
    
    ALTER TABLE IF EXISTS public.event_registrations
    ADD CONSTRAINT event_registrations_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES auth.users(id)
    ON DELETE SET NULL;

COMMIT;

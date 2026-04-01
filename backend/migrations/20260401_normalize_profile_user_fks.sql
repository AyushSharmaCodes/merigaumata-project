-- =====================================================
-- Normalize app-owned user foreign keys to public.profiles(id)
-- Created: 2026-04-01
--
-- These tables receive application user IDs (`req.user.id`) at runtime.
-- In this codebase those IDs are consistently treated as `public.profiles.id`,
-- not raw `auth.users.id` references.
-- =====================================================

BEGIN;

-- Email logs are written with application user IDs from the email service.
ALTER TABLE IF EXISTS public.email_notifications
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.email_notifications
    DROP CONSTRAINT IF EXISTS email_notifications_user_id_fkey;

ALTER TABLE IF EXISTS public.email_notifications
    ADD CONSTRAINT email_notifications_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT email_notifications_user_id_fkey ON public.email_notifications IS 'Reference profiles(id) for app-owned email log users';

-- Event registrations store the currently authenticated app user when available.
ALTER TABLE IF EXISTS public.event_registrations
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.event_registrations
    DROP CONSTRAINT IF EXISTS event_registrations_user_id_fkey;

ALTER TABLE IF EXISTS public.event_registrations
    ADD CONSTRAINT event_registrations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT event_registrations_user_id_fkey ON public.event_registrations IS 'Reference profiles(id) for registered app users';

-- Event refunds inherit the registration/app user identity.
ALTER TABLE IF EXISTS public.event_refunds
    ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE IF EXISTS public.event_refunds
    DROP CONSTRAINT IF EXISTS event_refunds_user_id_fkey;

ALTER TABLE IF EXISTS public.event_refunds
    ADD CONSTRAINT event_refunds_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT event_refunds_user_id_fkey ON public.event_refunds IS 'Reference profiles(id) for refunded app users';

-- Admin-triggered event cancellations use req.user.id from the app auth layer.
ALTER TABLE IF EXISTS public.events
    ALTER COLUMN cancelled_by DROP NOT NULL;

ALTER TABLE IF EXISTS public.events
    DROP CONSTRAINT IF EXISTS events_cancelled_by_fkey;

ALTER TABLE IF EXISTS public.events
    ADD CONSTRAINT events_cancelled_by_fkey
    FOREIGN KEY (cancelled_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON CONSTRAINT events_cancelled_by_fkey ON public.events IS 'Reference profiles(id) for cancelling admin/manager users';

COMMIT;

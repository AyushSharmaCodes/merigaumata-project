-- Fast duplicate-registration eligibility lookup by event + normalized email.
-- Assumes application writes event_registrations.email in lowercase.

UPDATE public.event_registrations
SET email = lower(email)
WHERE email IS NOT NULL
  AND email <> lower(email);

CREATE INDEX IF NOT EXISTS idx_event_registrations_active_event_email
ON public.event_registrations(event_id, email)
WHERE status NOT IN ('cancelled', 'refunded', 'failed');

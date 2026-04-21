-- Migration: Repair Event Module Schema
-- Date: 2026-04-19
-- Description: Fixes missing columns and indexes in event_registrations, event_refunds, and event_cancellation_jobs tables.

BEGIN;

-- 1. Repair event_registrations
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS registration_number VARCHAR(20);
ALTER TABLE public.event_registrations ADD COLUMN IF NOT EXISTS attendees INTEGER DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_reg_num ON public.event_registrations(registration_number);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event_id ON public.event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_user_id ON public.event_registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_email ON public.event_registrations(email);
CREATE INDEX IF NOT EXISTS idx_event_registrations_status ON public.event_registrations(status);

-- 2. Repair event_refunds
-- Drop incorrect FK constraint and fix type mismatch
ALTER TABLE public.event_refunds DROP CONSTRAINT IF EXISTS event_refunds_payment_id_fkey;
ALTER TABLE public.event_refunds ALTER COLUMN payment_id TYPE VARCHAR(100);

-- Handle registration_id vs event_registration_id
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_refunds' AND column_name = 'event_registration_id') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'event_refunds' AND column_name = 'registration_id') THEN
            ALTER TABLE public.event_refunds RENAME COLUMN event_registration_id TO registration_id;
        END IF;
    END IF;
END $$;

ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS refund_id VARCHAR(50);
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS gateway_reference VARCHAR(100);
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS initiated_at TIMESTAMPTZ;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS settled_at TIMESTAMPTZ;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE public.event_refunds ADD COLUMN IF NOT EXISTS failure_reason TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_refunds_gateway_ref ON public.event_refunds(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_event_refunds_registration_id ON public.event_refunds(registration_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_event_id ON public.event_refunds(event_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_user_id ON public.event_refunds(user_id);
CREATE INDEX IF NOT EXISTS idx_event_refunds_status ON public.event_refunds(status);

-- 3. Repair event_cancellation_jobs
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS correlation_id UUID;
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS total_registrations INTEGER DEFAULT 0;
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS processed_count INTEGER DEFAULT 0;
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 50;
ALTER TABLE public.event_cancellation_jobs ADD COLUMN IF NOT EXISTS last_processed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_event_cancellation_jobs_event_id ON public.event_cancellation_jobs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_cancellation_jobs_status ON public.event_cancellation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_event_cancellation_jobs_correlation_id ON public.event_cancellation_jobs(correlation_id);

COMMIT;

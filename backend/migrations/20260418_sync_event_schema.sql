-- Recovery Migration to Sync Events Table Schema
-- Adds missing columns required by EventService and get_events_paginated RPC

ALTER TABLE public.events ADD COLUMN IF NOT EXISTS start_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS end_time TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS base_price NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS gst_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS registration_deadline TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancellation_status TEXT DEFAULT 'NONE';
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancellation_correlation_id TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS key_highlights_i18n JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS special_privileges_i18n JSONB DEFAULT '{}'::jsonb;

-- Update comments for clarity
COMMENT ON COLUMN public.events.start_time IS 'Event start time string (HH:mm)';
COMMENT ON COLUMN public.events.end_time IS 'Event end time string (HH:mm)';
COMMENT ON COLUMN public.events.cancellation_status IS 'Current status of event (NONE, PENDING, CANCELLED)';

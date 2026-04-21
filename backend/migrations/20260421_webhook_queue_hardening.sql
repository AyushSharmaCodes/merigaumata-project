-- Migration: Webhook Queue Hardening
-- Created: 2026-04-21
-- Description: Converts webhook_logs into a durable processing queue with retry support,
--              replay protection (dedup), and worker locking.

-- ============================================================================
-- 1. ADD QUEUE COLUMNS TO webhook_logs
-- ============================================================================

-- Processing status (replaces boolean 'processed' for richer state)
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'PENDING';

-- Retry support
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS retry_count INT DEFAULT 0;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS max_retries INT DEFAULT 5;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Error tracking (may already exist as 'processing_error', add normalized column)
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Worker locking (prevents double-processing across instances)
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS locked_by TEXT;

-- Updated timestamp
ALTER TABLE public.webhook_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================================
-- 2. BACKFILL: Sync existing 'processed' boolean → 'status' column
-- ============================================================================

UPDATE public.webhook_logs
SET status = CASE
    WHEN processed = true THEN 'DONE'
    WHEN processed = false AND processing_error IS NOT NULL THEN 'FAILED'
    ELSE 'PENDING'
END
WHERE status = 'PENDING' AND processed = true;

-- ============================================================================
-- 3. INDEXES FOR QUEUE WORKER
-- ============================================================================

-- Primary queue worker index: fetch PENDING/FAILED events ready for processing
CREATE INDEX IF NOT EXISTS idx_webhook_logs_queue
    ON public.webhook_logs(status, next_retry_at)
    WHERE status IN ('PENDING', 'FAILED');

-- Worker lock cleanup: find stale locks
CREATE INDEX IF NOT EXISTS idx_webhook_logs_locked
    ON public.webhook_logs(locked_at)
    WHERE locked_at IS NOT NULL AND status = 'PROCESSING';

-- ============================================================================
-- 4. REPLAY PROTECTION: Unique constraint on verified events
-- ============================================================================

-- Prevent duplicate processing of the same Razorpay event
-- Only applies to verified events with a non-null event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_dedup
    ON public.webhook_logs(event_id, event_type)
    WHERE event_id IS NOT NULL AND signature_verified = true;

-- ============================================================================
-- 5. ADDITIONAL PERFORMANCE INDEXES
-- ============================================================================

-- Payment status polling optimization
CREATE INDEX IF NOT EXISTS idx_payments_user_id_status
    ON public.payments(user_id, status)
    WHERE user_id IS NOT NULL;

-- Orphan payment lookup
CREATE INDEX IF NOT EXISTS idx_payments_captured_orphan
    ON public.payments(status, created_at)
    WHERE status = 'CAPTURED_ORPHAN';

-- Event registration sweep
CREATE INDEX IF NOT EXISTS idx_event_reg_payment_status_created
    ON public.event_registrations(payment_status, created_at)
    WHERE payment_status IN ('CREATED', 'PENDING', 'created', 'captured', 'pending');

-- Donation sweep
CREATE INDEX IF NOT EXISTS idx_donations_payment_status_created
    ON public.donations(payment_status, created_at)
    WHERE payment_status IN ('CREATED', 'PENDING', 'created', 'pending', 'authorized');

-- ============================================================================
-- 6. STATUS CONSTRAINT (soft — allows legacy values during Phase A)
-- ============================================================================

-- Add a check constraint on webhook_logs.status
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'webhook_logs_status_check'
    ) THEN
        ALTER TABLE public.webhook_logs
        ADD CONSTRAINT webhook_logs_status_check
        CHECK (status IN ('PENDING', 'PROCESSING', 'DONE', 'FAILED', 'DEAD_LETTER'));
    END IF;
END $$;

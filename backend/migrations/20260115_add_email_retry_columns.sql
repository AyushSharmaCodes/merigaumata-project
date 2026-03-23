-- Migration: Add Email Retry Columns
-- Created: 2026-01-15
-- Description: Adds retry mechanism and correlation tracking to email_notifications

-- ============================================================================
-- 1. ADD RETRY COLUMNS TO EMAIL_NOTIFICATIONS TABLE
-- ============================================================================

-- Idempotency key for preventing duplicate emails
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'idempotency_key'
    ) THEN
        ALTER TABLE email_notifications ADD COLUMN idempotency_key VARCHAR(255);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_email_notifications_idempotency 
            ON email_notifications(idempotency_key) 
            WHERE idempotency_key IS NOT NULL;
        COMMENT ON COLUMN email_notifications.idempotency_key IS 'Unique key to prevent duplicate email sends';
    END IF;
END $$;

-- Retry count
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'retry_count'
    ) THEN
        ALTER TABLE email_notifications ADD COLUMN retry_count INTEGER DEFAULT 0;
        COMMENT ON COLUMN email_notifications.retry_count IS 'Number of retry attempts for failed emails';
    END IF;
END $$;

-- Max retries
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'max_retries'
    ) THEN
        ALTER TABLE email_notifications ADD COLUMN max_retries INTEGER DEFAULT 3;
        COMMENT ON COLUMN email_notifications.max_retries IS 'Maximum retry attempts before marking as permanent failure';
    END IF;
END $$;

-- Next retry timestamp
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'next_retry_at'
    ) THEN
        ALTER TABLE email_notifications ADD COLUMN next_retry_at TIMESTAMPTZ;
        CREATE INDEX IF NOT EXISTS idx_email_notifications_retry 
            ON email_notifications(next_retry_at) 
            WHERE status = 'FAILED' AND retry_count < 3;
        COMMENT ON COLUMN email_notifications.next_retry_at IS 'When to attempt next retry (exponential backoff)';
    END IF;
END $$;

-- Correlation ID for tracing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'email_notifications' AND column_name = 'correlation_id'
    ) THEN
        ALTER TABLE email_notifications ADD COLUMN correlation_id VARCHAR(255);
        CREATE INDEX IF NOT EXISTS idx_email_notifications_correlation 
            ON email_notifications(correlation_id) 
            WHERE correlation_id IS NOT NULL;
        COMMENT ON COLUMN email_notifications.correlation_id IS 'Request correlation ID for distributed tracing';
    END IF;
END $$;

-- ============================================================================
-- 2. ADD PERMANENTLY_FAILED STATUS SUPPORT
-- ============================================================================

-- Update status check constraint if exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'email_notifications_status_check'
    ) THEN
        ALTER TABLE email_notifications DROP CONSTRAINT email_notifications_status_check;
    END IF;
    
    ALTER TABLE email_notifications ADD CONSTRAINT email_notifications_status_check 
        CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'PERMANENTLY_FAILED'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

COMMENT ON TABLE email_notifications IS 'Email notification logs with retry mechanism and correlation tracking';

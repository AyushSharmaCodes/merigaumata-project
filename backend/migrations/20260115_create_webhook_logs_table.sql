-- Migration: Create Webhook Logs Table
-- Created: 2026-01-15
-- Description: Stores incoming webhook events from payment providers for audit trail

-- ============================================================================
-- CREATE WEBHOOK LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Provider and Event Info
    provider TEXT NOT NULL DEFAULT 'razorpay',
    event_type TEXT NOT NULL,
    event_id TEXT,
    
    -- Payload (complete webhook body)
    payload JSONB NOT NULL DEFAULT '{}',
    
    -- Security
    signature_verified BOOLEAN DEFAULT FALSE,
    ip_address TEXT,
    
    -- Processing Status
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    processing_error TEXT,
    
    -- Correlation
    correlation_id TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT webhook_logs_provider_check CHECK (provider IN ('razorpay', 'stripe', 'other'))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Event lookup
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_type ON webhook_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id ON webhook_logs(event_id);

-- Processing status
CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON webhook_logs(processed) WHERE processed = FALSE;

-- Time-based queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Provider filtering
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider ON webhook_logs(provider);

-- Correlation lookup
CREATE INDEX IF NOT EXISTS idx_webhook_logs_correlation ON webhook_logs(correlation_id) WHERE correlation_id IS NOT NULL;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only service role can insert (webhooks come from external sources)
CREATE POLICY "Service role can insert webhook logs"
    ON webhook_logs FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Only service role can update (for marking as processed)
CREATE POLICY "Service role can update webhook logs"
    ON webhook_logs FOR UPDATE
    TO service_role
    USING (true);

-- Admins can read all logs
CREATE POLICY "Admins can read webhook logs"
    ON webhook_logs FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles p
            INNER JOIN roles r ON p.role_id = r.id
            WHERE p.id = auth.uid() AND r.name IN ('admin', 'manager')
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE webhook_logs IS 'Stores incoming webhook events from payment providers for audit trail and debugging';
COMMENT ON COLUMN webhook_logs.signature_verified IS 'Whether the webhook signature was validated against the secret';
COMMENT ON COLUMN webhook_logs.processed IS 'Whether the webhook event has been processed by our system';

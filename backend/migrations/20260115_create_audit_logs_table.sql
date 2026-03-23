-- Migration: Create Audit Logs Table
-- Created: 2026-01-15
-- Description: Immutable audit log table for financial events and compliance

-- ============================================================================
-- 1. CREATE AUDIT_LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event identification
    event_type VARCHAR(100) NOT NULL,      -- ORDER_CREATED, INVOICE_GENERATED, REFUND_PROCESSED
    
    -- Actor information
    actor_type VARCHAR(20) NOT NULL,        -- SYSTEM, ADMIN, CUSTOMER
    actor_id UUID,                          -- User ID if applicable
    
    -- Entity being acted upon
    entity_type VARCHAR(50) NOT NULL,       -- order, invoice, refund, return
    entity_id UUID NOT NULL,
    
    -- Correlation for tracing
    correlation_id VARCHAR(255),
    
    -- Data snapshots
    diff_snapshot JSONB,                    -- Before/after state for updates
    metadata JSONB,                         -- Additional context
    
    -- Retention
    retention_until DATE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. CREATE INDEXES FOR AUDIT QUERIES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type 
    ON audit_logs(event_type);

CREATE INDEX IF NOT EXISTS idx_audit_logs_entity 
    ON audit_logs(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation 
    ON audit_logs(correlation_id) 
    WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at 
    ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor 
    ON audit_logs(actor_type, actor_id);

-- ============================================================================
-- 3. ENABLE RLS AND CREATE IMMUTABILITY POLICIES
-- ============================================================================

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow inserts from service role only
DROP POLICY IF EXISTS "audit_logs_insert_only" ON audit_logs;
CREATE POLICY "audit_logs_insert_only" ON audit_logs 
    FOR INSERT 
    WITH CHECK (true);

-- Prevent updates
DROP POLICY IF EXISTS "audit_logs_no_update" ON audit_logs;
CREATE POLICY "audit_logs_no_update" ON audit_logs 
    FOR UPDATE 
    USING (false);

-- Prevent deletes
DROP POLICY IF EXISTS "audit_logs_no_delete" ON audit_logs;
CREATE POLICY "audit_logs_no_delete" ON audit_logs 
    FOR DELETE 
    USING (false);

-- Allow read for service role (admin queries)
DROP POLICY IF EXISTS "audit_logs_read" ON audit_logs;
CREATE POLICY "audit_logs_read" ON audit_logs 
    FOR SELECT 
    USING (true);

-- ============================================================================
-- 4. CREATE TRIGGER FOR RETENTION DATE
-- ============================================================================

CREATE OR REPLACE FUNCTION set_audit_retention_date()
RETURNS TRIGGER AS $$
BEGIN
    -- Set retention to 8 years from creation (GST compliance)
    NEW.retention_until = (NEW.created_at + INTERVAL '8 years')::DATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_retention ON audit_logs;
CREATE TRIGGER trg_audit_retention
    BEFORE INSERT ON audit_logs
    FOR EACH ROW
    EXECUTE FUNCTION set_audit_retention_date();

-- ============================================================================
-- 5. ADD TABLE COMMENT
-- ============================================================================

COMMENT ON TABLE audit_logs IS 'Immutable audit log for financial events, GST compliance, and admin actions. Retention: 8 years.';
COMMENT ON COLUMN audit_logs.event_type IS 'Event type: ORDER_CREATED, INVOICE_GENERATED, REFUND_PROCESSED, CREDIT_NOTE_ISSUED, RETURN_APPROVED, etc.';
COMMENT ON COLUMN audit_logs.actor_type IS 'Who triggered the action: SYSTEM, ADMIN, or CUSTOMER';
COMMENT ON COLUMN audit_logs.diff_snapshot IS 'JSON containing before/after state for updates';
COMMENT ON COLUMN audit_logs.retention_until IS 'Auto-set to 8 years from creation for GST compliance';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

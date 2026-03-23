-- Migration: Enhance refunds table to support job tracking
-- Date: 2026-02-18

-- 1. Add new columns for job tracking
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS error_log JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add trigger for updated_at (if not already present via handle_updated_at)
DROP TRIGGER IF EXISTS refunds_updated_at ON refunds;
CREATE TRIGGER refunds_updated_at
    BEFORE UPDATE ON refunds
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- 3. Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);
CREATE INDEX IF NOT EXISTS idx_refunds_created_at ON refunds(created_at DESC);

-- Migration: Add metadata column to payments table
-- Created: 2026-01-21
-- Description: Adds a JSONB metadata column to store additional payment information like receipt IDs

ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add index for metadata queries
CREATE INDEX IF NOT EXISTS idx_payments_metadata ON payments USING gin (metadata);

-- Add comment
COMMENT ON COLUMN payments.metadata IS 'JSONB field for storing additional payment metadata such as receipt IDs, tracking info, etc.';

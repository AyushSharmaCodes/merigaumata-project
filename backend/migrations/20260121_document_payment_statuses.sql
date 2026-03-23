-- Migration: Add documentation for payment status values
-- Created: 2026-01-21
-- Description: Documents all valid payment status values including refund_failed

-- Add comprehensive comment documenting all valid payment statuses
COMMENT ON COLUMN payments.status IS 'Payment status: created, captured, paid, failed, refunded, refund_initiated, refund_failed, partial_refunded';

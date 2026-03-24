-- Migration: Normalize refund job statuses and enforce schema contract
-- Description: Aligns refunds.status and refunds.razorpay_refund_status with the production refund job state machine.

BEGIN;

-- Normalize legacy and lowercase refund job statuses.
UPDATE refunds
SET status = CASE
    WHEN status IS NULL OR btrim(status) = '' THEN 'PENDING'
    WHEN upper(btrim(status)) IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED') THEN upper(btrim(status))
    WHEN upper(btrim(status)) = 'COMPLETED' THEN 'PROCESSED'
    WHEN lower(btrim(status)) = 'processed' THEN 'PROCESSED'
    WHEN lower(btrim(status)) = 'processing' THEN 'PROCESSING'
    WHEN lower(btrim(status)) = 'pending' THEN 'PENDING'
    WHEN lower(btrim(status)) = 'failed' THEN 'FAILED'
    ELSE 'FAILED'
END;

-- Normalize gateway refund statuses as well.
UPDATE refunds
SET razorpay_refund_status = CASE
    WHEN razorpay_refund_status IS NULL OR btrim(razorpay_refund_status) = '' THEN
        CASE
            WHEN status = 'PROCESSED' THEN 'PROCESSED'
            WHEN status = 'FAILED' THEN 'FAILED'
            ELSE 'PENDING'
        END
    WHEN upper(btrim(razorpay_refund_status)) IN ('PENDING', 'PROCESSED', 'FAILED') THEN upper(btrim(razorpay_refund_status))
    ELSE 'FAILED'
END;

ALTER TABLE refunds
ALTER COLUMN status SET DEFAULT 'PENDING',
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN updated_at SET DEFAULT NOW(),
ALTER COLUMN retry_count SET DEFAULT 0,
ALTER COLUMN error_log SET DEFAULT '[]'::jsonb;

ALTER TABLE refunds
DROP CONSTRAINT IF EXISTS refunds_status_check;

ALTER TABLE refunds
ADD CONSTRAINT refunds_status_check
CHECK (status IN ('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED'));

ALTER TABLE refunds
DROP CONSTRAINT IF EXISTS refunds_razorpay_refund_status_check;

ALTER TABLE refunds
ADD CONSTRAINT refunds_razorpay_refund_status_check
CHECK (razorpay_refund_status IN ('PENDING', 'PROCESSED', 'FAILED'));

COMMENT ON COLUMN refunds.status IS 'Refund job status: PENDING, PROCESSING, PROCESSED, FAILED';
COMMENT ON COLUMN refunds.razorpay_refund_status IS 'Gateway refund status mirrored from Razorpay: PENDING, PROCESSED, FAILED';

CREATE INDEX IF NOT EXISTS idx_refunds_status_created_at
ON refunds(status, created_at DESC);

COMMIT;

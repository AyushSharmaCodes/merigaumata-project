-- ==============================================================================
-- MIGRATION: 20260417_architectural_hardening.sql
-- PURPOSE: Decouple status domains, implement optimistic locking, and harden concurrency.
-- ==============================================================================

BEGIN;

-- 1. Add Version Column for Optimistic Locking
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE public.qc_audits ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS version INTEGER DEFAULT 0;

-- 2. Expand Returns Table for Domain Separation
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS qc_status VARCHAR(50) DEFAULT 'NOT_STARTED';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS refund_status VARCHAR(50) DEFAULT 'NOT_STARTED';
ALTER TABLE public.returns ADD COLUMN IF NOT EXISTS return_outcome VARCHAR(50);

-- 3. Harden Refund Idempotency
ALTER TABLE public.refunds ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
-- We'll create the unique constraint only after mapping existing data (to avoid failures if duplicates exist)
-- Actually, since it's a new system, we expect few existing refunds. 
-- For safety, we can make it unique for new entries.
ALTER TABLE public.refunds ADD CONSTRAINT unique_refund_idempotency UNIQUE (idempotency_key);

-- 4. Harden QC Uniqueness
-- Ensure one primary audit per item (administrative overrides can update existing audits)
CREATE UNIQUE INDEX IF NOT EXISTS idx_qc_one_per_item ON public.qc_audits(return_item_id);

-- 5. LEGACY DATA MIGRATION
-- Map existing overloaded 'status' from returns/orders to the new domain fields.

-- A. Map Returns
UPDATE public.returns
SET 
  qc_status = CASE 
    WHEN status IN ('qc_passed', 'partial_refund', 'zero_refund', 'refund_initiated', 'refunded') THEN 'QC_PASSED'
    WHEN status = 'qc_failed' THEN 'QC_FAILED'
    WHEN status = 'qc_initiated' THEN 'QC_INITIATED'
    ELSE 'NOT_STARTED'
  END,
  refund_status = CASE 
    WHEN status = 'refunded' THEN 'REFUNDED'
    WHEN status IN ('refund_initiated', 'gateway_processing') THEN 'REFUND_INITIATED'
    ELSE 'NOT_STARTED'
  END,
  return_outcome = CASE 
    WHEN status = 'partial_refund' THEN 'PARTIAL_REFUND'
    WHEN status = 'zero_refund' THEN 'ZERO_REFUND'
    WHEN status = 'return_to_customer' THEN 'RETURN_BACK_TO_CUSTOMER'
    WHEN status = 'dispose_liquidate' THEN 'DISPOSE_OR_LIQUIDATE'
    ELSE NULL
  END;

COMMIT;

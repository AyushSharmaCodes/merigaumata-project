-- ==============================================================================
-- MIGRATION: 20260423_fix_returns_status_constraint.sql
-- PURPOSE:
--   Fix the returns_status_check constraint to include 'pickup_failed' and
--   'zero_refund' which are valid return workflow states used by the backend
--   service but were missing from the CHECK constraint.
--
-- ROOT CAUSE:
--   The 20260420_repair_order_detail_schema migration expanded the constraint
--   but omitted 'pickup_failed' and 'zero_refund'. This causes a DB-level
--   rejection when admin tries to mark a pickup as failed.
-- ==============================================================================

BEGIN;

-- Drop and recreate with ALL valid return workflow statuses
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns
    ADD CONSTRAINT returns_status_check
    CHECK (status IN (
        'requested',
        'approved',
        'rejected',
        'completed',
        'picked_up',
        'pickup_scheduled',
        'pickup_attempted',
        'pickup_completed',
        'pickup_failed',
        'in_transit',
        'in_transit_to_warehouse',
        'item_returned',
        'qc_initiated',
        'qc_passed',
        'qc_failed',
        'partial_refund',
        'zero_refund',
        'refund_initiated',
        'refunded',
        'cancelled'
    ));

COMMIT;

-- Force PostgREST to pick up the new schema
NOTIFY pgrst, 'reload schema';

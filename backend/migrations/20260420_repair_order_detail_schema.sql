-- ==============================================================================
-- MIGRATION: 20260420_repair_order_detail_schema.sql
-- PURPOSE:
--   Fix the 500 Internal Server Error on the Order Detail page (admin & customer).
--   The `getOrderById` service function selects several columns that are missing
--   from the live database, causing PostgREST to return a schema error.
--
-- MISSING COLUMNS FOUND:
--   1. orders       → payment_id, invoice_id, invoice_url, currency, display_currency
--   2. returns      → refund_breakdown  (+ status constraint expansion)
--   3. return_items → reason, condition
--   4. refunds      → notes
-- ==============================================================================

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. REPAIR `orders` table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Razorpay payment ID stored directly on the order (legacy / quick-lookup)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN payment_id TEXT;
    END IF;

    -- Soft UUID reference to the active internal invoice row.
    -- NOTE: No FK constraint here to avoid a circular dependency:
    --   orders.invoice_id → invoices.id → invoices.order_id → orders
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'invoice_id'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN invoice_id UUID;
    END IF;

    -- Cached public URL for the invoice (Razorpay short_url or internal path)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'invoice_url'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN invoice_url TEXT;
    END IF;

    -- ISO-4217 currency code for the order (e.g. 'INR', 'USD')
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'currency'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN currency TEXT DEFAULT 'INR';
    END IF;

    -- Display currency (may differ from base currency for multi-currency UI)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'display_currency'
    ) THEN
        ALTER TABLE public.orders ADD COLUMN display_currency TEXT DEFAULT 'INR';
    END IF;
END $$;

-- Backfill defaults for existing rows
UPDATE public.orders
SET
    currency         = COALESCE(currency, 'INR'),
    display_currency = COALESCE(display_currency, 'INR')
WHERE currency IS NULL OR display_currency IS NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. REPAIR `returns` table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Structured breakdown of refund amounts per line item (used by QC/refund calc)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'refund_breakdown'
    ) THEN
        ALTER TABLE public.returns ADD COLUMN refund_breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;
END $$;

-- Expand the `returns.status` CHECK constraint to include all workflow states
-- used by the return/QC/pickup pipeline.
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
        'in_transit',
        'in_transit_to_warehouse',
        'qc_initiated',
        'qc_passed',
        'qc_failed',
        'partial_refund',
        'refund_initiated',
        'refunded',
        'cancelled'
    ));


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. REPAIR `return_items` table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Customer-supplied reason for returning this specific item
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'reason'
    ) THEN
        ALTER TABLE public.return_items ADD COLUMN reason TEXT;
    END IF;

    -- Physical condition of the returned item as assessed by QC
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'condition'
    ) THEN
        ALTER TABLE public.return_items ADD COLUMN condition TEXT;
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. REPAIR `refunds` table
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    -- Human-readable notes (distinct from structured `reason`; used for admin comments)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'refunds' AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.refunds ADD COLUMN notes TEXT;
    END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add index on orders.payment_id for quick lookups
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_orders_payment_id
    ON public.orders(payment_id)
    WHERE payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_invoice_id
    ON public.orders(invoice_id)
    WHERE invoice_id IS NOT NULL;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. REPAIR `products` table (missing price_includes_tax column)
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'price_includes_tax'
    ) THEN
        ALTER TABLE public.products ADD COLUMN price_includes_tax BOOLEAN DEFAULT true;
    END IF;
END $$;


COMMIT;

-- Force PostgREST to pick up the new schema
NOTIFY pgrst, 'reload schema';

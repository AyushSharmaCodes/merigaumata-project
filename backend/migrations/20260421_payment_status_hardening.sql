-- ================================================================
-- PAYMENT STATUS HARDENING MIGRATION
-- Date: 2026-04-21
-- Version: 1.0.0
--
-- Phase A: Add missing columns and indexes.
-- Status normalization is handled by the application-layer
-- compatibility mapper (status-mapper.js) during transition.
-- Phase B SQL normalization runs after 3-5 days stable.
-- ================================================================

-- ==========================================
-- 1. MISSING INDEXES (Webhook Performance)
-- ==========================================

-- Donations: razorpay_order_id is queried on every donation webhook
CREATE INDEX IF NOT EXISTS idx_donations_razorpay_order_id
    ON public.donations(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

-- Donations: razorpay_payment_id is queried for payment lookups
CREATE INDEX IF NOT EXISTS idx_donations_razorpay_payment_id
    ON public.donations(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Event Registrations: razorpay_order_id is queried on every event webhook
CREATE INDEX IF NOT EXISTS idx_event_registrations_razorpay_order_id
    ON public.event_registrations(razorpay_order_id) WHERE razorpay_order_id IS NOT NULL;

-- Event Registrations: razorpay_payment_id for payment lookups
CREATE INDEX IF NOT EXISTS idx_event_registrations_razorpay_payment_id
    ON public.event_registrations(razorpay_payment_id) WHERE razorpay_payment_id IS NOT NULL;

-- Payments: status + created_at for sweep cron queries
CREATE INDEX IF NOT EXISTS idx_payments_status_created
    ON public.payments(status, created_at)
    WHERE status IN ('CREATED', 'PENDING', 'created', 'captured', 'pending');

-- ==========================================
-- 2. MISSING COLUMNS
-- ==========================================

-- 2a. Payments: total_refunded_amount (referenced in webhook refund logic)
ALTER TABLE public.payments
    ADD COLUMN IF NOT EXISTS total_refunded_amount NUMERIC(12,2) DEFAULT 0;

-- 2b. Refunds: refund_type (referenced in webhook when creating refund records)
ALTER TABLE public.refunds
    ADD COLUMN IF NOT EXISTS refund_type TEXT DEFAULT 'BUSINESS_REFUND';

-- 2c. Refunds: razorpay_refund_status (referenced in webhook refund processing)
ALTER TABLE public.refunds
    ADD COLUMN IF NOT EXISTS razorpay_refund_status TEXT;

-- 2d. Donation Subscriptions: missing donor info and billing columns
ALTER TABLE public.donation_subscriptions
    ADD COLUMN IF NOT EXISTS donor_name TEXT,
    ADD COLUMN IF NOT EXISTS donor_email TEXT,
    ADD COLUMN IF NOT EXISTS donor_phone TEXT,
    ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS current_start TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS current_end TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_billing_at TIMESTAMPTZ;

-- ==========================================
-- 3. WEBHOOK LOGS: Add missing columns and index
-- ==========================================

-- Ensure expected columns exist (schema drift sync)
ALTER TABLE public.webhook_logs
    ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'razorpay',
    ADD COLUMN IF NOT EXISTS event_id TEXT,
    ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS correlation_id TEXT,
    ADD COLUMN IF NOT EXISTS processed BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS processing_error TEXT;

-- Prevent duplicate webhook processing by event_id
CREATE INDEX IF NOT EXISTS idx_webhook_logs_event_id_processed
    ON public.webhook_logs(event_id, processed)
    WHERE event_id IS NOT NULL;

-- ==========================================
-- 4. DONE — Phase B normalization runs later
-- ==========================================
-- Phase B (after 3-5 days stable) will:
--   1. UPDATE all legacy status values to UPPERCASE
--   2. ADD CHECK constraints to enforce valid statuses
--   3. REMOVE the status-mapper.js compatibility layer

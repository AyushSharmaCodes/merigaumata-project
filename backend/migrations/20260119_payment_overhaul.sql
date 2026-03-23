-- Migration: 20260119_payment_overhaul.sql
-- Description: Updates payments, refunds, and order_status_history tables for robust payment management.

-- 1. ENUMS (Implemented as Check Constraints for flexibility unless strictly necessary)

-- 2. UPDATE PAYMENTS TABLE
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS refund_type TEXT CHECK (refund_type IN ('BUSINESS_REFUND', 'TECHNICAL_REFUND', 'NONE')),
ADD COLUMN IF NOT EXISTS total_refunded_amount DECIMAL(10, 2) DEFAULT 0.00;

-- Ensure payment_status covers new states (assuming it's TEXT, adding comment/check for future)
-- Existing statuses: created, authorized, captured, failed, refunded, partially_refunded
-- New Mapping: 
-- 'captured' -> PAYMENT_SUCCESS 
-- 'failed' -> PAYMENT_FAILED
-- 'refunded' -> REFUND_COMPLETED
-- 'partially_refunded' -> REFUND_PARTIAL
-- 'refund_initiated' -> REFUND_INITIATED

-- 3. UPDATE REFUNDS TABLE
ALTER TABLE refunds 
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id),
ADD COLUMN IF NOT EXISTS refund_type TEXT CHECK (refund_type IN ('BUSINESS_REFUND', 'TECHNICAL_REFUND')),
ADD COLUMN IF NOT EXISTS reason TEXT, -- Renaming/Ensuring standard naming. existing might be 'reason'
ADD COLUMN IF NOT EXISTS razorpay_refund_status TEXT CHECK (razorpay_refund_status IN ('PENDING', 'PROCESSED', 'FAILED'));

-- 4. UPDATE ORDER_STATUS_HISTORY (TIMELINE)
ALTER TABLE order_status_history 
ADD COLUMN IF NOT EXISTS event_type TEXT CHECK (event_type IN (
    'ORDER_PLACED', 
    'PAYMENT_SUCCESS', 
    'PAYMENT_FAILED', 
    'CANCELLED', 
    'RETURNED', 
    'REFUND_INITIATED', 
    'REFUND_COMPLETED',
    'REFUND_PARTIAL', -- Added for granularity
    'STATUS_CHANGE'   -- Default for generic status updates
)),
ADD COLUMN IF NOT EXISTS actor TEXT DEFAULT 'SYSTEM' CHECK (actor IN ('SYSTEM', 'ADMIN', 'USER', 'STAFF'));

-- 5. UPDATE EXISTING DATA (Backfill defaults)
UPDATE payments SET refund_type = 'NONE' WHERE refund_type IS NULL;
UPDATE payments SET total_refunded_amount = 0.00 WHERE total_refunded_amount IS NULL;

-- Backfill actor for existing history
UPDATE order_status_history SET actor = 'SYSTEM' WHERE actor IS NULL AND updated_by IS NULL;
UPDATE order_status_history SET actor = 'ADMIN' WHERE actor IS NULL AND updated_by IS NOT NULL; -- Assumption

-- 6. INDEXES for performance
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_razorpay_id ON refunds(razorpay_refund_id);

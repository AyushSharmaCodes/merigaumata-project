-- Migration: Add delivery refundability metadata and refund audit logs
-- File: backend/migrations/20260118_razorpay_refund_updates.sql

-- 1. Update orders table with refund-specific metadata
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delivery_refundable BOOLEAN DEFAULT TRUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tax_type TEXT DEFAULT 'GST';

COMMENT ON COLUMN orders.is_delivery_refundable IS 'Flag indicating if the delivery charge is eligible for refund during cancellation/return';
COMMENT ON COLUMN orders.delivery_tax_type IS 'Type of tax applied to delivery (GST / NON_GST)';

-- 2. Create refund audit logs table
CREATE TABLE IF NOT EXISTS refund_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id),
    payment_id TEXT NOT NULL,
    refund_type TEXT NOT NULL, -- BUSINESS_REFUND, TECHNICAL_REFUND
    original_paid_amount DECIMAL(10,2) NOT NULL,
    delivery_charge_excluded DECIMAL(10,2) DEFAULT 0,
    delivery_gst_excluded DECIMAL(10,2) DEFAULT 0,
    refunded_amount DECIMAL(10,2) NOT NULL,
    razorpay_refund_id TEXT NOT NULL,
    initiated_by TEXT NOT NULL, -- SYSTEM, ADMIN, USER
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster audit retrieval
CREATE INDEX IF NOT EXISTS idx_refund_audit_order_id ON refund_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_refund_audit_payment_id ON refund_audit_logs(payment_id);

COMMENT ON TABLE refund_audit_logs IS 'Immutable logs for every refund transaction for audit and compliance';

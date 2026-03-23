-- Migration: 20260121_unified_rls_hotfix.sql
-- Description: Unified RLS policies and schema restoration for refunds, orders, and payments.
-- This ensures both Admins and Owners can see necessary data and fixes the missing refund data issue.

-- 1. RESTORE MISSING REFUND COLUMNS
-- These may have been missed in previous migrations or environment syncs.
DO $$
BEGIN
    -- Add columns to refunds if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'payment_id') THEN
        ALTER TABLE refunds ADD COLUMN payment_id UUID REFERENCES payments(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'refund_type') THEN
        ALTER TABLE refunds ADD COLUMN refund_type TEXT CHECK (refund_type IN ('BUSINESS_REFUND', 'TECHNICAL_REFUND'));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'reason') THEN
        ALTER TABLE refunds ADD COLUMN reason TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'refunds' AND column_name = 'razorpay_refund_status') THEN
        ALTER TABLE refunds ADD COLUMN razorpay_refund_status TEXT CHECK (razorpay_refund_status IN ('PENDING', 'PROCESSED', 'FAILED'));
    END IF;
END $$;

-- 2. HELPER FUNCTIONS (Ensure they exist and are robust)
CREATE OR REPLACE FUNCTION is_admin_or_manager()
RETURNS BOOLEAN AS $$
DECLARE
    u_role TEXT;
BEGIN
    SELECT r.name INTO u_role
    FROM profiles p
    JOIN roles r ON p.role_id = r.id
    WHERE p.id = auth.uid();
    
    RETURN (u_role = 'admin' OR u_role = 'manager');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. UNIFY RLS POLICIES

-- Apply to ORDERS
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
DROP POLICY IF EXISTS "Enable all operations for orders" ON orders; -- Extreme fallback

CREATE POLICY "orders_select_policy" ON orders
    FOR SELECT USING (auth.uid() = user_id OR is_admin_or_manager());

CREATE POLICY "orders_write_policy" ON orders
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Apply to REFUNDS
DROP POLICY IF EXISTS "Users can view own refunds" ON refunds;
DROP POLICY IF EXISTS "Service role can manage refunds" ON refunds;
DROP POLICY IF EXISTS "Enable all operations for refunds" ON refunds;

CREATE POLICY "refunds_select_policy" ON refunds
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid())
        OR is_admin_or_manager()
    );

CREATE POLICY "refunds_service_policy" ON refunds
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Apply to PAYMENTS
DROP POLICY IF EXISTS "Users can view own payments" ON payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON payments;

CREATE POLICY "payments_select_policy" ON payments
    FOR SELECT USING (auth.uid() = user_id OR is_admin_or_manager());

CREATE POLICY "payments_service_policy" ON payments
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Apply to ORDER_STATUS_HISTORY
DROP POLICY IF EXISTS "Users can view their own order status history" ON order_status_history;
DROP POLICY IF EXISTS "Service role can manage order status history" ON order_status_history;

CREATE POLICY "history_select_policy" ON order_status_history
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid())
        OR is_admin_or_manager()
    );

CREATE POLICY "history_service_policy" ON order_status_history
    FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Apply to INVOICES (Just in case)
DROP POLICY IF EXISTS "Users can view own invoices" ON invoices;
CREATE POLICY "invoices_select_policy" ON invoices
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.user_id = auth.uid())
        OR is_admin_or_manager()
    );

-- 4. ENSURE INDEXES FOR PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id_v2 ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_order_id_v2 ON refunds(order_id);

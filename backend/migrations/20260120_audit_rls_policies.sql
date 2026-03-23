-- ============================================================================
-- Migration: Audit and Add RLS Policies for Critical Tables
-- Created: 2026-01-20
-- ============================================================================

-- ============================================================================
-- PAYMENTS TABLE
-- ============================================================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Service role can do all
DROP POLICY IF EXISTS "Enable all for service_role" ON public.payments;
CREATE POLICY "Enable all for service_role"
ON public.payments
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own payments via order link
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
ON public.payments
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = payments.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ============================================================================
-- REFUNDS TABLE
-- ============================================================================
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- Service role can do all
DROP POLICY IF EXISTS "Enable all for service_role" ON public.refunds;
CREATE POLICY "Enable all for service_role"
ON public.refunds
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view refunds for their orders
DROP POLICY IF EXISTS "Users can view own refunds" ON public.refunds;
CREATE POLICY "Users can view own refunds"
ON public.refunds
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = refunds.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Service role can do all
DROP POLICY IF EXISTS "Enable all for service_role" ON public.invoices;
CREATE POLICY "Enable all for service_role"
ON public.invoices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own invoices via order link
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
CREATE POLICY "Users can view own invoices"
ON public.invoices
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = invoices.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ============================================================================
-- ORDER_STATUS_HISTORY TABLE
-- ============================================================================
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- Service role can do all
DROP POLICY IF EXISTS "Enable all for service_role" ON public.order_status_history;
CREATE POLICY "Enable all for service_role"
ON public.order_status_history
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view history for their own orders
DROP POLICY IF EXISTS "Users can view own order history" ON public.order_status_history;
CREATE POLICY "Users can view own order history"
ON public.order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_status_history.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ============================================================================
-- ORDER_ITEMS TABLE - Verify policies exist
-- ============================================================================
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Service role can do all
DROP POLICY IF EXISTS "Enable all for service_role" ON public.order_items;
CREATE POLICY "Enable all for service_role"
ON public.order_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Users can view their own order items
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.orders
        WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
);

-- ============================================================================
-- AUDIT_LOGS TABLE - Backend only
-- ============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
        
        DROP POLICY IF EXISTS "Enable all for service_role" ON public.audit_logs;
        CREATE POLICY "Enable all for service_role"
        ON public.audit_logs
        FOR ALL
        TO service_role
        USING (true)
        WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

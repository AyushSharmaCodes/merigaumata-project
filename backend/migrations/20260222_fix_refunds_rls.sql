-- Migration: Fix RLS policies for refunds table
-- Description: Adds missing INSERT and UPDATE policies for the refunds table to allow backend services to manage it.

BEGIN;

-- 1. Ensure RLS is enabled
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing restrictive select policy if we want to replace it, 
-- but actually we just need to add the missing ones.
-- However, let's make it consistent with the "ALL" pattern used for other critical tables.

DROP POLICY IF EXISTS "Users view own refunds" ON refunds;
DROP POLICY IF EXISTS "System can manage refunds" ON refunds;
DROP POLICY IF EXISTS "Service role can manage refunds" ON refunds;

-- 3. Policy for users to view their own refunds
CREATE POLICY "Users view own refunds" ON refunds 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);

-- 4. Policy for system/admin to manage refunds (INSERT, UPDATE)
-- This covers both explicit admin users and the service role bypass
CREATE POLICY "System can manage refunds" ON refunds 
FOR ALL USING (is_admin_or_manager())
WITH CHECK (is_admin_or_manager());

-- 5. Explicitly allow service role just in case (though it should bypass anyway)
CREATE POLICY "Service role can manage refunds" ON refunds
FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 6. Add missing policies for invoices
DROP POLICY IF EXISTS "Users view own invoices" ON invoices;
DROP POLICY IF EXISTS "System can manage invoices" ON invoices;
DROP POLICY IF EXISTS "Service role can manage invoices" ON invoices;

CREATE POLICY "Users view own invoices" ON invoices 
FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);

CREATE POLICY "System can manage invoices" ON invoices 
FOR ALL USING (is_admin_or_manager())
WITH CHECK (is_admin_or_manager());

CREATE POLICY "Service role can manage invoices" ON invoices
FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMIT;

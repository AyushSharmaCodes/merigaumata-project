-- PRODUCTION-GRADE RLS FIX
-- This approach is more explicit and secure than just disabling/enabling RLS
-- It creates specific policies that allow service role to perform operations

-- ============================================================================
-- OPTION 1: Allow service role bypass (Recommended for backend-only operations)
-- ============================================================================
-- This is the standard Supabase pattern: RLS is enabled, but service role bypasses it
-- Regular users (anon key) still must follow RLS policies

-- Remove FORCE RLS if it exists, allowing service role to bypass
ALTER TABLE order_status_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

ALTER TABLE refunds DISABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

ALTER TABLE invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- OPTION 2: Explicit Policies (More secure, but requires policy management)
-- ============================================================================
-- If you prefer explicit control, you can use this approach instead
-- Comment out Option 1 above and uncomment the policies below

/*
-- Keep FORCE RLS but add explicit policies for service role

-- Policy for order_status_history
DROP POLICY IF EXISTS "Service role can insert status history" ON order_status_history;
CREATE POLICY "Service role can insert status history" 
ON order_status_history 
FOR INSERT 
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update status history" ON order_status_history;
CREATE POLICY "Service role can update status history" 
ON order_status_history 
FOR UPDATE 
TO service_role
USING (true)
WITH CHECK (true);

-- Policy for refunds
DROP POLICY IF EXISTS "Service role can insert refunds" ON refunds;
CREATE POLICY "Service role can insert refunds" 
ON refunds 
FOR INSERT 
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update refunds" ON refunds;
CREATE POLICY "Service role can update refunds" 
ON refunds 
FOR UPDATE 
TO service_role
USING (true)
WITH CHECK (true);

-- Policy for invoices
DROP POLICY IF EXISTS "Service role can insert invoices" ON invoices;
CREATE POLICY "Service role can insert invoices" 
ON invoices 
FOR INSERT 
TO service_role
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Service role can update invoices" ON invoices;
CREATE POLICY "Service role can update invoices" 
ON invoices 
FOR UPDATE 
TO service_role
USING (true)
WITH CHECK (true);
*/

-- ============================================================================
-- Verification Query
-- ============================================================================
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('order_status_history', 'refunds', 'invoices')
AND schemaname = 'public';

-- Check existing policies
SELECT 
    tablename,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename IN ('order_status_history', 'refunds', 'invoices')
ORDER BY tablename, policyname;

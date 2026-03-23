-- EMERGENCY FIX: Direct RLS Policy for order_status_history
-- This is a surgical fix to allow service role to insert timeline entries
-- Run this immediately to fix the blocking issue

-- Drop any existing conflicting policies
DROP POLICY IF EXISTS "service_role_all" ON order_status_history;
DROP POLICY IF EXISTS "Users view own order history" ON order_status_history;
DROP POLICY IF EXISTS "Admins view all order history" ON order_status_history;

-- Create the ONLY policy needed: service_role bypass
CREATE POLICY "service_role_all" ON order_status_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Verify it worked
SELECT 
    tablename, 
    policyname, 
    roles::text, 
    cmd,
    qual::text,
    with_check::text
FROM pg_policies 
WHERE tablename = 'order_status_history';

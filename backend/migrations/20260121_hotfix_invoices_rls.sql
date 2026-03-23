-- ============================================================================
-- HOTFIX: Invoices Table RLS - Remove ALL conflicting policies
-- Run this BEFORE the comprehensive migration or separately
-- ============================================================================

-- Disable and re-enable RLS to clear state
ALTER TABLE public.invoices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on invoices table (common names from previous migrations)
DROP POLICY IF EXISTS "Enable all for service_role" ON public.invoices;
DROP POLICY IF EXISTS "service_role_all" ON public.invoices;
DROP POLICY IF EXISTS "Service role can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Service role can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "service_role_complete_bypass" ON public.invoices;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "users_view_own" ON public.invoices;

-- Create fresh service role bypass policy
CREATE POLICY "service_role_all"
ON public.invoices
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create user view policy
CREATE POLICY "users_view_own"
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

-- Grant necessary permissions
GRANT ALL ON public.invoices TO service_role;
GRANT SELECT ON public.invoices TO authenticated;

-- Verification
SELECT 
    policyname,
    roles,
    cmd,
    permissive
FROM pg_policies 
WHERE tablename = 'invoices'
ORDER BY policyname;

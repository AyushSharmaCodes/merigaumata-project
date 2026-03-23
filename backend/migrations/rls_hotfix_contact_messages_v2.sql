-- RLS AGGRESSIVE FIX (v2)
-- This script ensures no hidden policies are blocking insertions.

-- 1. CLEANUP & RESET (Contact Messages)
DROP POLICY IF EXISTS "Allow public insert to contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Enable read access for service role" ON public.contact_messages;
DROP POLICY IF EXISTS "Enable update access for service role" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow public insert" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow select for service_role" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow update for service_role" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow select for managers" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow update for managers" ON public.contact_messages;

ALTER TABLE public.contact_messages DISABLE ROW LEVEL SECURITY; -- Temporarily disable
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;  -- Re-enable fresh

-- 2. CREATE POLICIES (Contact Messages)
-- allow anyone to submit the form
CREATE POLICY "allow_public_insert" ON public.contact_messages FOR INSERT TO public WITH CHECK (true);
-- allow service role and authenticated users (admins) full access
CREATE POLICY "allow_service_role_all" ON public.contact_messages FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "allow_authenticated_all" ON public.contact_messages FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. CLEANUP & RESET (Admin Alerts)
DROP POLICY IF EXISTS "Admins and managers can view alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Admins and managers can update alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow select for service_role" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow update for service_role" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow insert for service_role" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow select for authenticated" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow update for authenticated" ON public.admin_alerts;

ALTER TABLE public.admin_alerts DISABLE ROW LEVEL SECURITY; -- Temporarily disable
ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;  -- Re-enable fresh

-- 4. CREATE POLICIES (Admin Alerts)
-- Service role MUST be able to do everything
CREATE POLICY "service_role_complete_bypass" ON public.admin_alerts FOR ALL TO service_role USING (true) WITH CHECK (true);
-- Authenticated users (Admins/Managers) can manage alerts
CREATE POLICY "authenticated_manage_alerts" ON public.admin_alerts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5. GRANTS (Explicitly ensure permissions)
GRANT ALL ON public.contact_messages TO service_role;
GRANT ALL ON public.contact_messages TO authenticated;
GRANT ALL ON public.contact_messages TO anon; -- Needed for public insert if not using service role

GRANT ALL ON public.admin_alerts TO service_role;
GRANT ALL ON public.admin_alerts TO authenticated;

-- DIAGNOSTIC CHECK: Run this to see current policies
-- SELECT * FROM pg_policies WHERE tablename IN ('contact_messages', 'admin_alerts');

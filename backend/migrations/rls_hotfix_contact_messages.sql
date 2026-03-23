-- RLS COMPREHENSIVE FIX for contact_messages & admin_alerts
-- 1. FIX contact_messages
DROP POLICY IF EXISTS "Allow public insert to contact_messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Enable read access for service role" ON public.contact_messages;
DROP POLICY IF EXISTS "Enable update access for service role" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can view all" ON public.contact_messages;
DROP POLICY IF EXISTS "Admins can update all" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow public insert" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow select for admins" ON public.contact_messages;
DROP POLICY IF EXISTS "Allow update for admins" ON public.contact_messages;

ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public insert" ON public.contact_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow select for service_role" ON public.contact_messages FOR SELECT TO service_role USING (true);
CREATE POLICY "Allow update for service_role" ON public.contact_messages FOR UPDATE TO service_role USING (true);
CREATE POLICY "Allow select for managers" ON public.contact_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update for managers" ON public.contact_messages FOR UPDATE TO authenticated USING (true);

-- 2. FIX admin_alerts
DROP POLICY IF EXISTS "Admins and managers can view alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Admins and managers can update alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Service role can insert alerts" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow select for service_role" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow update for service_role" ON public.admin_alerts;
DROP POLICY IF EXISTS "Allow insert for service_role" ON public.admin_alerts;

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

-- Policy to allow the backend (service_role) to create alerts
CREATE POLICY "Allow insert for service_role" ON public.admin_alerts FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Allow select for service_role" ON public.admin_alerts FOR SELECT TO service_role USING (true);
CREATE POLICY "Allow update for service_role" ON public.admin_alerts FOR UPDATE TO service_role USING (true);

-- Policy to allow admins/managers to manage alerts via frontend
CREATE POLICY "Allow select for authenticated" ON public.admin_alerts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow update for authenticated" ON public.admin_alerts FOR UPDATE TO authenticated USING (true);

-- 3. GRANTS
GRANT ALL ON TABLE public.contact_messages TO service_role;
GRANT INSERT ON TABLE public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.contact_messages TO authenticated;

GRANT ALL ON TABLE public.admin_alerts TO service_role;
GRANT SELECT, UPDATE ON TABLE public.admin_alerts TO authenticated;
GRANT INSERT ON TABLE public.admin_alerts TO authenticated; -- Sometimes needed if frontend triggers it

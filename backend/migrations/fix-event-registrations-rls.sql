-- Fix: Add missing RLS policies for event_registrations table
-- Currently only SELECT policy exists, causing INSERT to fail

-- RLS Policy: Authenticated users can create registrations for themselves
CREATE POLICY "Users can create own registrations"
ON event_registrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Users can update their own registrations (for status changes)
CREATE POLICY "Users can update own registrations"
ON event_registrations FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- RLS Policy: Service role can perform all operations (for backend operations)
-- Note: This is handled automatically by Supabase when using service_role key

-- Alternative: If backend needs to insert on behalf of users with service_role key,
-- ensure SUPABASE_SERVICE_ROLE_KEY is set in .env (bypasses RLS entirely)

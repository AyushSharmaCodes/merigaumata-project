-- Migration: 20260119_fix_phone_rls.sql
-- Description: Allow service_role to manage phone_numbers table to avoid RLS violations in backend services.

-- Allow service_role to manage phone numbers
CREATE POLICY "Service role can manage phone numbers"
ON public.phone_numbers FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON POLICY "Service role can manage phone numbers" ON public.phone_numbers IS 'Allows the backend service role to perform all operations on phone numbers regardless of ownership.';

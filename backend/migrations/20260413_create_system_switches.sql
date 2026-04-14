-- Migration: 20260413_create_system_switches.sql
-- Goal: Create a dedicated configuration table for backend system toggles.

CREATE TABLE IF NOT EXISTS public.system_switches (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Turn on RLS
ALTER TABLE public.system_switches ENABLE ROW LEVEL SECURITY;

-- Only authenticated users (likely admins via frontend) or the Service Role can read
CREATE POLICY "Enable read access for authenticated users to system_switches" 
    ON public.system_switches FOR SELECT 
    TO authenticated 
    USING (true);

-- Only admins (if RBAC is used) or the Service Role can modify
CREATE POLICY "Enable modify access for authenticated admins only" 
    ON public.system_switches FOR ALL 
    TO authenticated 
    USING ((auth.jwt() ->> 'role') = 'admin' OR (auth.jwt() ->> 'role') = 'service_role');

-- Seed the foundational configuration defaults directly mapped from the previous .env file
INSERT INTO public.system_switches (key, value, description)
VALUES
    ('ENABLE_INTERNAL_SCHEDULER', 'false'::jsonb, 'Toggle the internal Node.js chronological processing scheduler.'),
    ('ENABLE_RESERVATION_CLEANUP', 'false'::jsonb, 'Toggle automated cleanups of expired cart/stock reservations.'),
    ('RAZORPAY_SMS_NOTIFY', 'false'::jsonb, 'Allow Razorpay to automatically send SMS to customers on payment creation/success.'),
    ('RAZORPAY_EMAIL_NOTIFY', 'false'::jsonb, 'Allow Razorpay to automatically send Emails to customers on payment creation/success.'),
    ('AUTO_REPLY_ENABLED', 'true'::jsonb, 'Automatically dispatch "We have received your message" emails upon contact form submission.'),
    ('INVOICE_STORAGE_STRATEGY', '"SUPABASE"'::jsonb, 'Strategy for storing generated invoices. Options: SUPABASE, LOCAL, BOTH'),
    ('CURRENCY_PRIMARY_PROVIDER', '"currencyapi.net"'::jsonb, 'The active third-party provider for fetching live currency exchange rates.'),
    ('LOG_PROVIDER', '"file"'::jsonb, 'Target for application logs (file, stdout, newrelic).'),
    ('CACHE_PROVIDER', '"memory"'::jsonb, 'Cache strategy (memory, redis, etc).'),
    ('BRAND_LOGO_URL', '"https://fyhindvbdzwczfgilxvl.supabase.co/storage/v1/object/public/brand-assets/brand-logo.png"'::jsonb, 'Official URL for the brand logo.'),
    ('ALLOWED_ORIGINS', '"http://localhost:5173,http://localhost:3000,http://localhost:4173"'::jsonb, 'Comma separated list of allowed CORS origins.'),
    ('SELLER_STATE_CODE', '"09"'::jsonb, 'State code of the seller for tax and invoice generation.'),
    ('SELLER_GSTIN', '"09CAGPK6646A1ZR"'::jsonb, 'GSTIN of the seller business.'),
    ('SELLER_CIN', '""'::jsonb, 'CIN of the seller business.'),
    ('NEW_RELIC_ENABLED', 'false'::jsonb, 'Determines if NewRelic APM agents should be activated.'),
    ('EMAIL_PROVIDER', '"smtp"'::jsonb, 'Provider for dispatching emails (smtp, ses, console, etc).'),
    ('SUPPORT_EMAIL', '"support@merigaumata.com"'::jsonb, 'Primary customer support email.'),
    ('NODE_ENV', '"development"'::jsonb, 'Current environment mode (development, production).'),
    ('AUTH_COOKIE_SAMESITE', '"lax"'::jsonb, 'SameSite policy for auth cookies.'),
    ('AUTH_COOKIE_SECURE', 'false'::jsonb, 'Secure policy for auth cookies.')
ON CONFLICT (key) DO NOTHING;

-- Create an auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_system_switches_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_system_switches_updated_at ON public.system_switches;
CREATE TRIGGER update_system_switches_updated_at
    BEFORE UPDATE ON public.system_switches
    FOR EACH ROW
    EXECUTE FUNCTION update_system_switches_updated_at_column();

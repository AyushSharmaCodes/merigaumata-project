-- ================================================================
-- MERIGAUMATA PROJECT: DEFINITIVE BASELINE
-- Date: 2026-04-01 (RECONCILED UP TO 2026-04-14)
-- Version: 5.0.0 (Clean Zero-Config Baseline)
--
-- This file is the single source of truth for a fresh Supabase
-- database. It integrates ALL migrations through 2026-04-14.
--
-- DO NOT append ad-hoc patches to the bottom of this file.
-- All future schema changes should be separate migration files.
-- ================================================================

-- ==========================================
-- 1. EXTENSIONS
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. ENUMS
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_notification_type') THEN
        CREATE TYPE email_notification_type AS ENUM (
            'REGISTRATION',
            'ORDER_CONFIRMATION',
            'ORDER_STATUS_UPDATE',
            'ORDER_SHIPPED',
            'ORDER_DELIVERED',
            'EVENT_REGISTRATION',
            'DONATION_RECEIPT',
            'SUBSCRIPTION_STARTED',
            'SUBSCRIPTION_CANCELLED',
            'SUBSCRIPTION_RENEWED',
            'SUBSCRIPTION_PAUSED',
            'SUBSCRIPTION_RESUMED',
            'OTP_VERIFICATION',
            'PASSWORD_RESET',
            'PASSWORD_CHANGE_OTP',
            'EMAIL_CONFIRMATION',
            'ACCOUNT_DELETED',
            'ACCOUNT_DELETION_SCHEDULED',
            'ACCOUNT_DELETION_OTP',
            'MANAGER_WELCOME',
            'CONTACT_NOTIFICATION',
            'CONTACT_AUTO_REPLY',
            'EVENT_CANCELLATION',
            'EVENT_UPDATE'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'variant_mode_type') THEN
        CREATE TYPE variant_mode_type AS ENUM ('UNIT', 'SIZE');
    END IF;
END $$;

-- ==========================================
-- 3. UTILITY TRIGGER FUNCTION
-- ==========================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ==========================================
-- 4. CORE TABLES
-- ==========================================

-- 4.1 Roles
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

INSERT INTO public.roles (name)
VALUES ('admin'), ('manager'), ('customer')
ON CONFLICT (name) DO NOTHING;

-- 4.2 Profiles
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    phone TEXT,
    role_id INTEGER REFERENCES public.roles(id),
    first_name VARCHAR(100) NOT NULL DEFAULT 'User',
    last_name VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    avatar_url TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMPTZ,
    is_blocked BOOLEAN DEFAULT false,
    must_change_password BOOLEAN DEFAULT false,
    created_by UUID REFERENCES public.profiles(id),
    email_verification_token TEXT,
    email_verification_expires TIMESTAMPTZ,
    email_verified BOOLEAN DEFAULT false,
    phone_verified BOOLEAN DEFAULT false,
    auth_provider TEXT DEFAULT 'LOCAL' CHECK (auth_provider IN ('LOCAL', 'GOOGLE')),
    password_reset_token TEXT,
    password_reset_expires TIMESTAMPTZ,
    deletion_status VARCHAR(50) DEFAULT 'ACTIVE',
    scheduled_deletion_at TIMESTAMPTZ,
    deletion_requested_at TIMESTAMPTZ,
    deletion_reason TEXT,
    welcome_email_sent BOOLEAN DEFAULT false,
    preferred_language VARCHAR(5) DEFAULT 'en' CHECK (preferred_language IN ('en', 'hi', 'ta', 'te')),
    preferred_currency TEXT DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON public.profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_token ON public.profiles(email_verification_token) WHERE email_verification_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_password_reset_token ON public.profiles(password_reset_token) WHERE password_reset_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_status ON public.profiles(deletion_status) WHERE deletion_status <> 'ACTIVE';

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 4.3 is_admin_or_manager helper
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('admin', 'manager')
    );
END;
$$;

-- 4.4 user_owns_order helper
CREATE OR REPLACE FUNCTION public.user_owns_order(order_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.orders
        WHERE id = order_uuid
          AND user_id = auth.uid()
    );
END;
$$;

-- ==========================================
-- 5. AUTH TABLES
-- ==========================================

-- 5.1 Auth Accounts
CREATE TABLE IF NOT EXISTS public.auth_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    password_set_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 Auth Identities
CREATE TABLE IF NOT EXISTS public.auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('LOCAL', 'GOOGLE')),
    provider_user_id TEXT,
    provider_email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_auth_accounts_email ON public.auth_accounts(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_user ON public.auth_identities(provider, provider_user_id) WHERE provider_user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_auth_identities_provider_email ON public.auth_identities(provider, provider_email) WHERE provider_email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_identities_user_id ON public.auth_identities(user_id);

ALTER TABLE public.auth_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_identities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_auth_accounts" ON public.auth_accounts;
CREATE POLICY "service_role_all_auth_accounts" ON public.auth_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_all_auth_identities" ON public.auth_identities;
CREATE POLICY "service_role_all_auth_identities" ON public.auth_identities FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS auth_accounts_updated_at ON public.auth_accounts;
CREATE TRIGGER auth_accounts_updated_at BEFORE UPDATE ON public.auth_accounts FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
DROP TRIGGER IF EXISTS auth_identities_updated_at ON public.auth_identities;
CREATE TRIGGER auth_identities_updated_at BEFORE UPDATE ON public.auth_identities FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- 5.3 OTP Codes
CREATE TABLE IF NOT EXISTS public.otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INTEGER DEFAULT 0 CHECK (attempts <= 3),
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_identifier ON public.otp_codes(identifier) WHERE verified = false;
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_codes(expires_at) WHERE verified = false;

ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_otp_codes" ON public.otp_codes;
CREATE POLICY "service_role_all_otp_codes" ON public.otp_codes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5.4 App Refresh Tokens
CREATE TABLE IF NOT EXISTS public.app_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    rotated_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_token ON public.app_refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user ON public.app_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_app_refresh_tokens_user_expires ON public.app_refresh_tokens(user_id, expires_at DESC);

ALTER TABLE public.app_refresh_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_app_refresh_tokens" ON public.app_refresh_tokens;
CREATE POLICY "service_role_all_app_refresh_tokens" ON public.app_refresh_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5.5 Auth Refresh Metrics
CREATE TABLE IF NOT EXISTS public.auth_refresh_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    reason TEXT,
    correlation_id TEXT,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status_code INTEGER,
    has_refresh_token_cookie BOOLEAN,
    has_access_token_cookie BOOLEAN,
    rotated_refresh_token BOOLEAN,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_created_at ON public.auth_refresh_metrics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_event_type ON public.auth_refresh_metrics(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_reason ON public.auth_refresh_metrics(reason, created_at DESC) WHERE reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_correlation ON public.auth_refresh_metrics(correlation_id) WHERE correlation_id IS NOT NULL;

ALTER TABLE public.auth_refresh_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_auth_refresh_metrics" ON public.auth_refresh_metrics;
CREATE POLICY "service_role_all_auth_refresh_metrics" ON public.auth_refresh_metrics FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================
-- 6. ACCOUNT DELETION TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.account_deletion_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    mode VARCHAR(20) NOT NULL,
    scheduled_for TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    steps_completed JSONB DEFAULT '[]'::jsonb,
    current_step VARCHAR(100),
    error_log JSONB DEFAULT '[]'::jsonb,
    retry_count INTEGER DEFAULT 0,
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.account_deletion_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_hash VARCHAR(64) NOT NULL,
    action VARCHAR(50) NOT NULL,
    actor VARCHAR(20) NOT NULL,
    actor_id UUID,
    mode VARCHAR(20),
    result VARCHAR(20) NOT NULL,
    blocking_reasons JSONB,
    metadata JSONB,
    correlation_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.deletion_authorization_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    device_fingerprint VARCHAR(255),
    action VARCHAR(50) NOT NULL DEFAULT 'ACCOUNT_DELETE',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT false,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.account_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deletion_authorization_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_account_deletion_jobs" ON public.account_deletion_jobs;
CREATE POLICY "service_role_account_deletion_jobs" ON public.account_deletion_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_account_deletion_audit" ON public.account_deletion_audit;
CREATE POLICY "service_role_account_deletion_audit" ON public.account_deletion_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_deletion_authorization_tokens" ON public.deletion_authorization_tokens;
CREATE POLICY "service_role_deletion_authorization_tokens" ON public.deletion_authorization_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================
-- 7. REQUEST STATE TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.idempotency_keys (
    cache_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    correlation_id TEXT,
    in_progress BOOLEAN NOT NULL DEFAULT true,
    status_code INTEGER,
    response JSONB,
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.request_locks (
    lock_key TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    correlation_id TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.idempotency_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_locks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_idempotency_keys" ON public.idempotency_keys;
CREATE POLICY "service_role_idempotency_keys" ON public.idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "service_role_request_locks" ON public.request_locks;
CREATE POLICY "service_role_request_locks" ON public.request_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS idempotency_keys_updated_at ON public.idempotency_keys;
CREATE TRIGGER idempotency_keys_updated_at BEFORE UPDATE ON public.idempotency_keys FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
DROP TRIGGER IF EXISTS request_locks_updated_at ON public.request_locks;
CREATE TRIGGER request_locks_updated_at BEFORE UPDATE ON public.request_locks FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ==========================================
-- 8. MANAGER PERMISSIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.manager_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    can_manage_products BOOLEAN DEFAULT false,
    can_manage_categories BOOLEAN DEFAULT false,
    can_manage_orders BOOLEAN DEFAULT false,
    can_manage_events BOOLEAN DEFAULT false,
    can_manage_blogs BOOLEAN DEFAULT false,
    can_manage_testimonials BOOLEAN DEFAULT false,
    can_add_testimonials BOOLEAN DEFAULT false,
    can_approve_testimonials BOOLEAN DEFAULT false,
    can_manage_gallery BOOLEAN DEFAULT false,
    can_manage_faqs BOOLEAN DEFAULT false,
    can_manage_carousel BOOLEAN DEFAULT false,
    can_manage_contact_info BOOLEAN DEFAULT false,
    can_manage_social_media BOOLEAN DEFAULT false,
    can_manage_bank_details BOOLEAN DEFAULT false,
    can_manage_about_us BOOLEAN DEFAULT false,
    can_manage_newsletter BOOLEAN DEFAULT false,
    can_manage_reviews BOOLEAN DEFAULT false,
    can_manage_policies BOOLEAN DEFAULT false,
    can_manage_contact_messages BOOLEAN DEFAULT false,
    can_manage_coupons BOOLEAN DEFAULT false,
    can_manage_delivery_configs BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.manager_permissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Managers can view their own permissions" ON public.manager_permissions;
CREATE POLICY "Managers can view their own permissions" ON public.manager_permissions FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Service role can manage all permissions" ON public.manager_permissions;
CREATE POLICY "Service role can manage all permissions" ON public.manager_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS manager_permissions_updated_at ON public.manager_permissions;
CREATE TRIGGER manager_permissions_updated_at BEFORE UPDATE ON public.manager_permissions FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ==========================================
-- 9. STORE SETTINGS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
CREATE POLICY "Public can view store settings" ON public.store_settings FOR SELECT USING (key IN ('delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode', 'base_currency'));
DROP POLICY IF EXISTS "Service role can manage all settings" ON public.store_settings;
CREATE POLICY "Service role can manage all settings" ON public.store_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS store_settings_updated_at ON public.store_settings;
CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

INSERT INTO public.store_settings (key, value, description) VALUES
('delivery_threshold', '1500', 'Minimum order amount for free delivery'),
('delivery_charge', '50', 'Standard delivery charge for orders below threshold'),
('delivery_gst', '0', 'Standard GST rate for delivery charges'),
('delivery_gst_mode', '"inclusive"', 'How delivery GST should be applied'),
('base_currency', '"INR"', 'Default display currency'),
('is_maintenance_mode', 'false', 'Global flag to force maintenance mode overlay'),
('maintenance_bypass_ips', '""', 'Comma separated list of Admin IPs allowed to bypass maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- 10. SYSTEM SWITCHES (Dynamic Config)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.system_switches (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.system_switches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable read access for authenticated users to system_switches" ON public.system_switches;
CREATE POLICY "Enable read access for authenticated users to system_switches" ON public.system_switches FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Enable modify access for authenticated admins only" ON public.system_switches;
CREATE POLICY "Enable modify access for authenticated admins only" ON public.system_switches FOR ALL TO authenticated USING ((auth.jwt() ->> 'role') = 'admin' OR (auth.jwt() ->> 'role') = 'service_role');

INSERT INTO public.system_switches (key, value, description) VALUES
('ENABLE_INTERNAL_SCHEDULER', 'false'::jsonb, 'Toggle the internal Node.js chronological processing scheduler.'),
('ENABLE_RESERVATION_CLEANUP', 'false'::jsonb, 'Toggle automated cleanups of expired cart/stock reservations.'),
('RAZORPAY_SMS_NOTIFY', 'false'::jsonb, 'Allow Razorpay to automatically send SMS to customers.'),
('RAZORPAY_EMAIL_NOTIFY', 'false'::jsonb, 'Allow Razorpay to automatically send Emails to customers.'),
('AUTO_REPLY_ENABLED', 'true'::jsonb, 'Auto-reply on contact form submission.'),
('INVOICE_STORAGE_STRATEGY', '"SUPABASE"'::jsonb, 'Invoice storage strategy: SUPABASE, LOCAL, BOTH'),
('CURRENCY_PRIMARY_PROVIDER', '"currencyapi.net"'::jsonb, 'Live currency exchange rate provider.'),
('LOG_PROVIDER', '"file"'::jsonb, 'Target for application logs.'),
('CACHE_PROVIDER', '"memory"'::jsonb, 'Cache strategy.'),
('BRAND_LOGO_URL', '""'::jsonb, 'Official URL for the brand logo.'),
('ALLOWED_ORIGINS', '"http://localhost:5173,http://localhost:3000,http://localhost:4173"'::jsonb, 'Comma separated list of allowed CORS origins.'),
('SELLER_STATE_CODE', '"09"'::jsonb, 'State code for tax/invoice.'),
('SELLER_GSTIN', '""'::jsonb, 'GSTIN of the seller business.'),
('SELLER_CIN', '""'::jsonb, 'CIN of the seller business.'),
('NEW_RELIC_ENABLED', 'false'::jsonb, 'Activate NewRelic APM agents.'),
('SUPPORT_EMAIL', '"support@merigaumata.com"'::jsonb, 'Primary customer support email.'),
('AUTH_COOKIE_SAMESITE', '"lax"'::jsonb, 'SameSite policy for auth cookies.'),
('AUTH_COOKIE_SECURE', 'false'::jsonb, 'Secure policy for auth cookies.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION update_system_switches_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_system_switches_updated_at ON public.system_switches;
CREATE TRIGGER update_system_switches_updated_at BEFORE UPDATE ON public.system_switches FOR EACH ROW EXECUTE FUNCTION update_system_switches_updated_at_column();

-- ==========================================
-- 10b. BRAND ASSETS (Media-Assets Bucket)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.brand_assets (
    key TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.brand_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read access to brand_assets" ON public.brand_assets;
CREATE POLICY "Public read access to brand_assets" ON public.brand_assets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Service role manages brand_assets" ON public.brand_assets;
CREATE POLICY "Service role manages brand_assets" ON public.brand_assets FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admins manage brand_assets" ON public.brand_assets;
CREATE POLICY "Admins manage brand_assets" ON public.brand_assets FOR ALL TO authenticated USING ((auth.jwt() ->> 'role') = 'admin') WITH CHECK ((auth.jwt() ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.update_brand_assets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS brand_assets_updated_at ON public.brand_assets;
CREATE TRIGGER brand_assets_updated_at BEFORE UPDATE ON public.brand_assets FOR EACH ROW EXECUTE FUNCTION public.update_brand_assets_updated_at();

INSERT INTO public.brand_assets (key, url, description) VALUES
('CONTACT_HERO', 'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/contact-hero.jpg', 'Hero background image for the Contact page.'),
('ABOUT_HERO',   'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/about-hero.jpg',   'Hero/story visual image for the About page.'),
('FAQ_HERO',     'https://wjdncjhlpioohrjkamqw.supabase.co/storage/v1/object/public/media-assets/faq-hero.jpg',     'Hero background image for the FAQ page.')
ON CONFLICT (key) DO NOTHING;

-- ==========================================
-- 11. CATEGORIES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'event', 'faq', 'gallery')),
    name_i18n JSONB DEFAULT '{}'::jsonb,
    category_code VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, type)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage categories" ON public.categories;
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

-- ==========================================
-- 12. PRODUCTS & VARIANTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    tags_i18n JSONB DEFAULT '{}'::jsonb,
    benefits_i18n JSONB DEFAULT '{}'::jsonb,
    price NUMERIC(10,2) NOT NULL,
    mrp NUMERIC(10,2),
    images TEXT[] DEFAULT '{}',
    category TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    tags TEXT[] DEFAULT '{}',
    inventory INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0,
    variant_mode variant_mode_type DEFAULT 'UNIT',
    benefits TEXT[] DEFAULT '{}',
    is_returnable BOOLEAN DEFAULT true,
    return_days INTEGER DEFAULT 3,
    is_new BOOLEAN DEFAULT false,
    rating NUMERIC(3,2) DEFAULT 0,
    "ratingCount" INTEGER DEFAULT 0,
    "reviewCount" INTEGER DEFAULT 0,
    default_hsn_code TEXT,
    default_gst_rate NUMERIC(5,2) DEFAULT 0,
    default_tax_applicable BOOLEAN DEFAULT false,
    default_price_includes_tax BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read products" ON public.products;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage products" ON public.products;
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());
DROP TRIGGER IF EXISTS products_updated_at ON public.products;
CREATE TRIGGER products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    size_label TEXT,
    size_label_i18n JSONB DEFAULT '{}'::jsonb,
    description TEXT,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    variant_image_url TEXT,
    sku TEXT,
    price NUMERIC(10,2) NOT NULL DEFAULT 0,
    mrp NUMERIC(10,2),
    stock_quantity INTEGER DEFAULT 0,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    razorpay_item_id TEXT,
    hsn_code VARCHAR(8),
    gst_rate NUMERIC(5,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_variants" ON public.product_variants;
CREATE POLICY "Public read product_variants" ON public.product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage product_variants" ON public.product_variants;
CREATE POLICY "Admins manage product_variants" ON public.product_variants FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

-- 12.1 Delivery Configs
CREATE TABLE IF NOT EXISTS public.delivery_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scope TEXT NOT NULL CHECK (scope IN ('PRODUCT', 'VARIANT')),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    region TEXT,
    charge NUMERIC(10,2) DEFAULT 0,
    gst_rate NUMERIC(5,2) DEFAULT 0,
    delivery_days_min INTEGER,
    delivery_days_max INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.delivery_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read delivery_configs" ON public.delivery_configs;
CREATE POLICY "Public read delivery_configs" ON public.delivery_configs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage delivery_configs" ON public.delivery_configs;
CREATE POLICY "Admins manage delivery_configs" ON public.delivery_configs FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

-- ==========================================
-- 13. COUPONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL,
    discount_percentage INTEGER,
    target_id TEXT,
    min_purchase_amount NUMERIC(10,2) DEFAULT 0,
    max_discount_amount NUMERIC(10,2),
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read coupons" ON public.coupons;
CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage coupons" ON public.coupons;
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id UUID,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (coupon_id, order_id)
);

-- ==========================================
-- 14. CART
-- ==========================================

CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
    guest_id TEXT UNIQUE,
    applied_coupon_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT carts_user_or_guest_check CHECK (user_id IS NOT NULL OR guest_id IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (cart_id, product_id, variant_id)
);

ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anonymous and Authenticated manage carts" ON public.carts;
DROP POLICY IF EXISTS "Users can manage own carts" ON public.carts;
CREATE POLICY "Users can manage own carts" ON public.carts 
    FOR ALL USING (auth.uid() = user_id OR (guest_id IS NOT NULL AND auth.uid() IS NULL)) 
    WITH CHECK (auth.uid() = user_id OR (guest_id IS NOT NULL AND auth.uid() IS NULL));

DROP POLICY IF EXISTS "Enable all operations for cart_items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can manage own cart items" ON public.cart_items;
CREATE POLICY "Users can manage own cart items" ON public.cart_items 
    FOR ALL TO anon, authenticated 
    USING (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_id AND (carts.user_id = auth.uid() OR carts.guest_id IS NOT NULL)))
    WITH CHECK (EXISTS (SELECT 1 FROM public.carts WHERE carts.id = cart_id AND (carts.user_id = auth.uid() OR carts.guest_id IS NOT NULL)));

-- ==========================================
-- 15. PHONE NUMBERS & ADDRESSES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.phone_numbers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    label VARCHAR(50) DEFAULT 'Mobile',
    is_primary BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, phone_number)
);
ALTER TABLE public.phone_numbers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own phones" ON public.phone_numbers;
CREATE POLICY "Users manage own phones" ON public.phone_numbers FOR ALL USING (user_id = auth.uid() OR public.is_admin_or_manager()) WITH CHECK (user_id = auth.uid() OR public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    full_name TEXT,
    phone TEXT,
    phone_number_id UUID REFERENCES public.phone_numbers(id),
    street_address TEXT NOT NULL,
    address_line1 TEXT,
    address_line2 TEXT,
    apartment TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    country TEXT DEFAULT 'India',
    label TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own addresses" ON public.addresses;
CREATE POLICY "Users can view own addresses" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own addresses" ON public.addresses;
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own addresses" ON public.addresses;
CREATE POLICY "Users can update own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete own addresses" ON public.addresses;
CREATE POLICY "Users can delete own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);

-- ==========================================
-- 16. ORDERS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_name TEXT,
    customer_email TEXT,
    customer_phone TEXT,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    shipping_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    billing_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL,
    shipping_address JSONB,
    billing_address JSONB,
    "shippingAddress" JSONB,
    items JSONB,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    "totalAmount" NUMERIC(12,2) NOT NULL DEFAULT 0,
    subtotal NUMERIC(12,2) DEFAULT 0,
    coupon_code TEXT,
    coupon_discount NUMERIC(12,2) DEFAULT 0,
    delivery_charge NUMERIC(12,2) DEFAULT 0,
    delivery_gst NUMERIC(12,2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    "paymentStatus" TEXT DEFAULT 'pending',
    invoice_status TEXT,
    notes TEXT,
    return_request JSONB,
    is_delivery_refundable BOOLEAN DEFAULT true,
    delivery_unsuccessful_reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_unsuccessful_reason ON public.orders(delivery_unsuccessful_reason) WHERE status = 'delivery_unsuccessful';
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Service role can manage orders" ON public.orders;
CREATE POLICY "Service role can manage orders" ON public.orders FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.product_variants(id) ON DELETE SET NULL,
    title TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_price NUMERIC(12,2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    mrp NUMERIC(12,2),
    is_returnable BOOLEAN DEFAULT true,
    returned_quantity INTEGER DEFAULT 0 CHECK (returned_quantity >= 0),
    delivery_charge NUMERIC(12,2) DEFAULT 0,
    delivery_gst NUMERIC(12,2) DEFAULT 0,
    delivery_calculation_snapshot JSONB,
    tax_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin_or_manager())));

CREATE TABLE IF NOT EXISTS public.order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    actor TEXT DEFAULT 'SYSTEM',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own order history" ON public.order_status_history;
CREATE POLICY "Users can view own order history" ON public.order_status_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin_or_manager())));
DROP POLICY IF EXISTS "Service role can manage order history" ON public.order_status_history;
CREATE POLICY "Service role can manage order history" ON public.order_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    title TEXT,
    message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_token TEXT UNIQUE NOT NULL,
    inventory_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.order_reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view order reservations" ON public.order_reservations;
CREATE POLICY "Public can view order reservations" ON public.order_reservations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Service role manage order reservations" ON public.order_reservations;
CREATE POLICY "Service role manage order reservations" ON public.order_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================
-- 17. PAYMENTS, INVOICES, RETURNS, REFUNDS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'created',
    payment_status TEXT,
    method TEXT,
    email TEXT,
    contact TEXT,
    error_code TEXT,
    error_description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    invoice_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Service role can manage payments" ON public.payments;
CREATE POLICY "Service role can manage payments" ON public.payments FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    invoice_number TEXT,
    provider_id TEXT,
    public_url TEXT,
    storage_path TEXT,
    status TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE NO ACTION,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    refund_amount NUMERIC(12,2),
    reason TEXT,
    staff_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.returns(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    status TEXT,
    images TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES public.returns(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    razorpay_refund_id TEXT,
    status TEXT,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 18. DONATIONS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    donation_reference_id TEXT UNIQUE NOT NULL,
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    amount NUMERIC(12,2) NOT NULL,
    donor_name TEXT,
    donor_email TEXT,
    donor_phone TEXT,
    is_anonymous BOOLEAN DEFAULT false,
    donation_type TEXT DEFAULT 'ONE_TIME',
    payment_status TEXT DEFAULT 'created',
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.donation_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
    donation_reference_id TEXT,
    razorpay_subscription_id TEXT UNIQUE,
    razorpay_plan_id TEXT,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'created',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 19. EVENTS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    location JSONB NOT NULL DEFAULT '{}'::jsonb,
    image TEXT,
    capacity INTEGER,
    registrations INTEGER DEFAULT 0,
    registration_amount NUMERIC(12,2) DEFAULT 0,
    gst_rate NUMERIC(5,2) DEFAULT 0,
    category TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT,
    schedule_type TEXT DEFAULT 'single_day',
    status TEXT DEFAULT 'upcoming',
    katha_vachak TEXT,
    contact_address TEXT,
    is_registration_enabled BOOLEAN DEFAULT true,
    key_highlights TEXT[] DEFAULT '{}',
    special_privileges TEXT[] DEFAULT '{}',
    event_code VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read events" ON public.events;
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins manage events" ON public.events;
CREATE POLICY "Admins manage events" ON public.events FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.event_registrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    attendees INTEGER DEFAULT 1,
    base_price NUMERIC(12,2),
    gst_rate NUMERIC(5,2) DEFAULT 0,
    gst_amount NUMERIC(12,2) DEFAULT 0,
    amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    payment_status TEXT DEFAULT 'created',
    status TEXT DEFAULT 'pending',
    razorpay_order_id TEXT,
    razorpay_payment_id TEXT,
    razorpay_signature TEXT,
    invoice_id TEXT,
    invoice_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_registration_id UUID REFERENCES public.event_registrations(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    amount NUMERIC(12,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.event_cancellation_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'PENDING',
    scheduled_for TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    retry_count INTEGER DEFAULT 0,
    error_log JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 20. BLOGS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.blogs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    content TEXT NOT NULL,
    author TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    excerpt_i18n JSONB DEFAULT '{}'::jsonb,
    content_i18n JSONB DEFAULT '{}'::jsonb,
    author_i18n JSONB DEFAULT '{}'::jsonb,
    tags_i18n JSONB DEFAULT '{}'::jsonb,
    date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    image TEXT,
    tags TEXT[] DEFAULT '{}',
    published BOOLEAN DEFAULT false,
    blog_code VARCHAR(100) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view published blogs" ON public.blogs;
CREATE POLICY "Public can view published blogs" ON public.blogs FOR SELECT USING (published = true OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Service role manage blogs" ON public.blogs;
CREATE POLICY "Service role manage blogs" ON public.blogs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ==========================================
-- 21. TESTIMONIALS & REVIEWS
-- ==========================================

CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT,
    role TEXT,
    content TEXT NOT NULL,
    name_i18n JSONB DEFAULT '{}'::jsonb,
    role_i18n JSONB DEFAULT '{}'::jsonb,
    content_i18n JSONB DEFAULT '{}'::jsonb,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    image TEXT,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public can view approved testimonials" ON public.testimonials;
CREATE POLICY "Public can view approved testimonials" ON public.testimonials FOR SELECT USING (approved = true OR auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Users can create testimonials" ON public.testimonials;
CREATE POLICY "Users can create testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Users can update testimonials" ON public.testimonials;
CREATE POLICY "Users can update testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Users can delete testimonials" ON public.testimonials;
CREATE POLICY "Users can delete testimonials" ON public.testimonials FOR DELETE USING (auth.uid() = user_id OR public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title TEXT,
    comment TEXT,
    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (product_id, user_id)
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews are viewable by everyone" ON public.reviews;
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users manage own reviews" ON public.reviews;
CREATE POLICY "Users manage own reviews" ON public.reviews FOR ALL USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());

-- ==========================================
-- 22. GALLERY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.gallery_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    name_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    is_hidden BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    is_home_carousel BOOLEAN DEFAULT false,
    is_mobile_carousel BOOLEAN DEFAULT false,
    cover_image TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_folders_home_carousel ON gallery_folders (is_home_carousel) WHERE is_home_carousel = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_gallery_folders_mobile_carousel ON gallery_folders (is_mobile_carousel) WHERE is_mobile_carousel = true;

CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES public.gallery_folders(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES public.gallery_folders(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    video_url TEXT NOT NULL,
    thumbnail_url TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 23. CAROUSEL SLIDES (Legacy, kept for fallback)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.carousel_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    subtitle_i18n JSONB DEFAULT '{}'::jsonb,
    image_url TEXT,
    image TEXT,
    order_index INTEGER DEFAULT 0,
    display_order INTEGER DEFAULT 0,
    link_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 24. FAQs
-- ==========================================

CREATE TABLE IF NOT EXISTS public.faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    question_i18n JSONB DEFAULT '{}'::jsonb,
    answer_i18n JSONB DEFAULT '{}'::jsonb,
    category TEXT,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 25. ABOUT US TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.about_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.about_impact_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    value TEXT NOT NULL,
    label TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.about_timeline (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    year TEXT NOT NULL,
    month TEXT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.about_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    bio TEXT NOT NULL,
    image_url TEXT,
    social_links JSONB DEFAULT '{}'::jsonb,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.about_future_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.about_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    footer_description TEXT DEFAULT '',
    section_visibility JSONB DEFAULT '{"missionVision": true, "impactStats": true, "ourStory": true, "team": true, "futureGoals": true, "callToAction": true}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.about_settings (footer_description)
SELECT ''
WHERE NOT EXISTS (SELECT 1 FROM public.about_settings);

-- ==========================================
-- 26. CONTACT INFO
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contact_info (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    pincode TEXT,
    country TEXT DEFAULT 'India',
    google_maps_link TEXT,
    map_latitude NUMERIC,
    map_longitude NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.contact_phones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number TEXT NOT NULL,
    label TEXT,
    label_i18n JSONB DEFAULT '{}'::jsonb,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.contact_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    label TEXT,
    is_primary BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.contact_office_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL,
    open_time TEXT,
    close_time TEXT,
    is_closed BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 27. SOCIAL, BANK, NEWSLETTER, POLICY
-- ==========================================

CREATE TABLE IF NOT EXISTS public.social_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    branch_name TEXT,
    upi_id TEXT,
    type TEXT NOT NULL CHECK (type IN ('general', 'donation')),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    qr_code_auto_url TEXT,
    qr_code_manual_url TEXT,
    use_manual_qr BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'subscribed',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.newsletter_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT,
    sender_email TEXT,
    footer_text TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.policy_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    content_i18n JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 28. COMMENTS & MODERATION
-- ==========================================

CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL,
    is_flagged BOOLEAN DEFAULT false NOT NULL,
    flag_reason TEXT,
    flag_count INTEGER DEFAULT 0 NOT NULL,
    flagged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    flagged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    edit_count INTEGER DEFAULT 0 NOT NULL,
    last_edited_at TIMESTAMPTZ,
    reply_count INTEGER DEFAULT 0 NOT NULL,
    upvotes INTEGER DEFAULT 0 NOT NULL,
    downvotes INTEGER DEFAULT 0 NOT NULL
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view active comments" ON public.comments;
CREATE POLICY "Anyone can view active comments" ON public.comments FOR SELECT USING (status = 'active' OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Authenticated users can create comments" ON public.comments;
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users manage own comments" ON public.comments;
CREATE POLICY "Users manage own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
DROP POLICY IF EXISTS "Users delete own comments" ON public.comments;
CREATE POLICY "Users delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id OR public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.comment_moderation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.comment_rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    comment_count INTEGER DEFAULT 1 NOT NULL,
    window_start TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    window_end TIMESTAMPTZ NOT NULL,
    UNIQUE (user_id, blog_id, window_start)
);

CREATE TABLE IF NOT EXISTS public.comment_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    flagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    UNIQUE (comment_id, flagged_by)
);

-- ==========================================
-- 29. PHOTOS (Media Tracking)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_url TEXT,
    image_path TEXT NOT NULL,
    bucket_name TEXT NOT NULL DEFAULT 'images',
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT,
    size BIGINT,
    mime_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 30. CONTACT MESSAGES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 31. EMAIL NOTIFICATIONS (Restructured)
-- ==========================================

CREATE TABLE IF NOT EXISTS public.email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    email_type email_notification_type NOT NULL,
    recipient_email TEXT,
    reference_id TEXT,
    status TEXT DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'NORMAL',
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 32. SYSTEM TABLES
-- ==========================================

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    reference_id TEXT,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    status TEXT DEFAULT 'received',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.geo_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cache_key TEXT UNIQUE NOT NULL,
    payload JSONB NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.currency_rate_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    base_currency TEXT NOT NULL,
    quote_currency TEXT NOT NULL,
    rate NUMERIC(18,8) NOT NULL,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (base_currency, quote_currency)
);

-- ==========================================
-- 33. UTILITY RPCs
-- ==========================================

CREATE OR REPLACE FUNCTION public.generate_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN 'ODR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$;

-- Create Manager with Permissions (v2)
-- Consolidates profile and permission creation into an atomic transaction
CREATE OR REPLACE FUNCTION public.create_manager_v2(
    p_user_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_first_name TEXT,
    p_last_name TEXT,
    p_creator_id UUID,
    p_verification_token TEXT,
    p_verification_expires TIMESTAMPTZ,
    p_permissions JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_role_id INTEGER;
    v_profile_result JSONB;
    v_perm_result JSONB;
BEGIN
    -- 1. Check if email exists
    IF EXISTS (SELECT 1 FROM public.profiles WHERE email = p_email) THEN
        RAISE EXCEPTION 'EMAIL_EXISTS';
    END IF;

    -- 2. Get Manager Role ID
    SELECT id INTO v_role_id FROM public.roles WHERE name = 'manager' LIMIT 1;
    IF v_role_id IS NULL THEN
        RAISE EXCEPTION 'ROLE_NOT_FOUND';
    END IF;

    -- 3. Insert Profile
    INSERT INTO public.profiles (
        id, email, name, first_name, last_name, role_id, 
        created_by, email_verification_token, email_verification_expires,
        email_verified, must_change_password, auth_provider
    ) VALUES (
        p_user_id, p_email, p_name, p_first_name, p_last_name, v_role_id,
        p_creator_id, p_verification_token, p_verification_expires,
        false, false, 'LOCAL'
    )
    RETURNING to_jsonb(public.profiles.*) INTO v_profile_result;

    -- 2. Insert Permissions
    INSERT INTO public.manager_permissions (
        user_id,
        is_active,
        can_manage_products,
        can_manage_categories,
        can_manage_orders,
        can_manage_events,
        can_manage_blogs,
        can_manage_testimonials,
        can_add_testimonials,
        can_approve_testimonials,
        can_manage_gallery,
        can_manage_faqs,
        can_manage_carousel,
        can_manage_contact_info,
        can_manage_social_media,
        can_manage_bank_details,
        can_manage_about_us,
        can_manage_newsletter,
        can_manage_reviews,
        can_manage_policies,
        can_manage_contact_messages,
        can_manage_coupons,
        can_manage_delivery_configs
    ) VALUES (
        p_user_id,
        true,
        (COALESCE(p_permissions->>'can_manage_products', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_categories', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_orders', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_events', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_blogs', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_testimonials', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_add_testimonials', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_approve_testimonials', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_gallery', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_faqs', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_carousel', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_contact_info', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_social_media', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_bank_details', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_about_us', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_newsletter', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_reviews', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_policies', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_contact_messages', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_coupons', 'false'))::boolean,
        (COALESCE(p_permissions->>'can_manage_delivery_configs', 'false'))::boolean
    )
    RETURNING to_jsonb(public.manager_permissions.*) INTO v_perm_result;

    RETURN jsonb_build_object(
        'profile', v_profile_result,
        'permissions', v_perm_result
    );
END;
$$;

-- 33c. Delete Manager (Atomic v1)
CREATE OR REPLACE FUNCTION public.delete_manager_v1(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Delete permissions
    DELETE FROM public.manager_permissions WHERE user_id = p_user_id;
    -- 2. Delete profile
    DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.log_email_notification(
    p_email_type email_notification_type,
    p_recipient_email TEXT,
    p_subject TEXT,
    p_html_preview TEXT,
    p_user_id UUID DEFAULT NULL,
    p_reference_id TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_priority VARCHAR(20) DEFAULT 'NORMAL'
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
    v_combined_metadata JSONB;
BEGIN
    v_combined_metadata := p_metadata || jsonb_build_object(
        'subject', p_subject,
        'html_preview', p_html_preview
    );

    INSERT INTO public.email_notifications (
        user_id, email_type, recipient_email, reference_id,
        status, metadata, priority
    ) VALUES (
        p_user_id, p_email_type, p_recipient_email, p_reference_id,
        'PENDING', v_combined_metadata, COALESCE(p_priority, 'NORMAL')
    )
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.merge_email_notification_metadata(
    p_log_id UUID,
    p_updates JSONB,
    p_metadata_updates JSONB DEFAULT '{}'::jsonb
) RETURNS void AS $$
BEGIN
    UPDATE public.email_notifications
    SET
        status = COALESCE((p_updates->>'status'), status),
        retry_count = COALESCE((p_updates->>'retry_count')::INTEGER, retry_count),
        user_id = COALESCE((p_updates->>'user_id')::UUID, user_id),
        metadata = metadata || COALESCE(p_metadata_updates, '{}'::jsonb),
        updated_at = NOW()
    WHERE id = p_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cleanup_old_email_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.email_notifications
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.cleanup_expired_refresh_tokens()
RETURNS void AS $$
BEGIN
    DELETE FROM public.app_refresh_tokens
    WHERE expires_at < NOW()
       OR (rotated_at IS NOT NULL AND rotated_at < NOW() - INTERVAL '60 seconds');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.set_primary_address(
    p_address_id UUID,
    p_user_id UUID,
    p_address_type TEXT,
    p_correlation_id UUID DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.addresses
    SET is_primary = false, updated_at = NOW()
    WHERE user_id = p_user_id AND id <> p_address_id;

    UPDATE public.addresses
    SET is_primary = true, updated_at = NOW()
    WHERE id = p_address_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.coupons
    SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
    WHERE id = p_coupon_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_event_registrations(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.events
    SET registrations = COALESCE(registrations, 0) + 1, updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.decrement_event_registrations(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.events
    SET registrations = GREATEST(COALESCE(registrations, 0) - 1, 0), updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_table_columns_info(t_name TEXT)
RETURNS TABLE (column_name TEXT, data_type TEXT, is_nullable TEXT)
LANGUAGE sql
SET search_path = public
AS $$
    SELECT c.column_name::TEXT, c.data_type::TEXT, c.is_nullable::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = t_name
    ORDER BY c.ordinal_position;
$$;

-- ==========================================
-- 34. INVENTORY RPCs
-- ==========================================

CREATE OR REPLACE FUNCTION public.decrease_variant_stock(
    p_variant_id UUID,
    p_quantity INTEGER
) RETURNS public.product_variants
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_variant public.product_variants;
BEGIN
    UPDATE public.product_variants
    SET stock_quantity = GREATEST(stock_quantity - COALESCE(p_quantity, 0), 0), updated_at = NOW()
    WHERE id = p_variant_id
    RETURNING * INTO v_variant;
    RETURN v_variant;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_inventory_atomic_v2(
    p_product_id UUID DEFAULT NULL,
    p_variant_id UUID DEFAULT NULL,
    p_quantity INTEGER DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF p_variant_id IS NOT NULL THEN
        UPDATE public.product_variants
        SET stock_quantity = COALESCE(stock_quantity, 0) + COALESCE(p_quantity, 0), updated_at = NOW()
        WHERE id = p_variant_id;
    ELSIF p_product_id IS NOT NULL THEN
        UPDATE public.products
        SET inventory = COALESCE(inventory, 0) + COALESCE(p_quantity, 0), updated_at = NOW()
        WHERE id = p_product_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_decrement_inventory_atomic(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        IF (v_item->>'variant_id') IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = GREATEST(stock_quantity - COALESCE((v_item->>'quantity')::INTEGER, 0), 0), updated_at = NOW()
            WHERE id = (v_item->>'variant_id')::UUID;
        ELSIF (v_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET inventory = GREATEST(inventory - COALESCE((v_item->>'quantity')::INTEGER, 0), 0), updated_at = NOW()
            WHERE id = (v_item->>'product_id')::UUID;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- Alias used by inventory.service.js
CREATE OR REPLACE FUNCTION public.batch_increment_inventory_atomic(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        IF (v_item->>'variant_id') IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = COALESCE(stock_quantity, 0) + COALESCE((v_item->>'quantity')::INTEGER, 0), updated_at = NOW()
            WHERE id = (v_item->>'variant_id')::UUID;
        ELSIF (v_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET inventory = COALESCE(inventory, 0) + COALESCE((v_item->>'quantity')::INTEGER, 0), updated_at = NOW()
            WHERE id = (v_item->>'product_id')::UUID;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- ==========================================
-- 35. PRODUCT CRUD RPCs
-- ==========================================

-- 35a. Upsert Product with Config (v1)
-- Handles product and its primary delivery config in one call
CREATE OR REPLACE FUNCTION public.upsert_product_with_config_v1(
    p_id UUID,
    p_product_data JSONB,
    p_delivery_config JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product_id UUID;
    v_product_result JSONB;
BEGIN
    -- 1. Upsert Product
    IF p_id IS NOT NULL THEN
        UPDATE public.products
        SET 
            title = COALESCE(p_product_data->>'title', title),
            description = COALESCE(p_product_data->>'description', description),
            title_i18n = COALESCE((p_product_data->'title_i18n'), title_i18n),
            description_i18n = COALESCE((p_product_data->'description_i18n'), description_i18n),
            price = (p_product_data->>'price')::numeric,
            mrp = (p_product_data->>'mrp')::numeric,
            category_id = (p_product_data->>'category_id')::uuid,
            inventory = (p_product_data->>'inventory')::integer,
            is_active = (p_product_data->>'is_active')::boolean,
            updated_at = NOW()
        WHERE id = p_id
        RETURNING id INTO v_product_id;
    ELSE
        INSERT INTO public.products (
            title, description, price, mrp, category_id, inventory, is_active
        ) VALUES (
            p_product_data->>'title', 
            p_product_data->>'description', 
            (p_product_data->>'price')::numeric, 
            (p_product_data->>'mrp')::numeric, 
            (p_product_data->>'category_id')::uuid, 
            (p_product_data->>'inventory')::integer, 
            COALESCE((p_product_data->>'is_active')::boolean, true)
        )
        RETURNING id INTO v_product_id;
    END IF;

    -- 2. Upsert Delivery Config
    IF p_delivery_config IS NOT NULL AND v_product_id IS NOT NULL THEN
        INSERT INTO public.delivery_configs (
            product_id, scope, charge, delivery_days_min, delivery_days_max, is_active, updated_at
        ) VALUES (
            v_product_id, 
            'PRODUCT', 
            (p_delivery_config->>'charge')::numeric, 
            (p_delivery_config->>'delivery_days_min')::integer, 
            (p_delivery_config->>'delivery_days_max')::integer, 
            true, 
            NOW()
        )
        ON CONFLICT (product_id, scope) WHERE variant_id IS NULL
        DO UPDATE SET 
            charge = EXCLUDED.charge,
            delivery_days_min = EXCLUDED.delivery_days_min,
            delivery_days_max = EXCLUDED.delivery_days_max,
            updated_at = NOW();
    END IF;

    SELECT to_jsonb(p.*) INTO v_product_result FROM public.products p WHERE p.id = v_product_id;
    RETURN v_product_result;
END;
$$;

-- 35b. Create Product with Variants
    p_product_data JSONB,
    p_variants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_product_id UUID;
    v_variant JSONB;
    v_variant_ids UUID[] := '{}';
    v_variant_id UUID;
BEGIN
    INSERT INTO public.products (
        title, description, price, mrp, images, category, category_id, tags,
        inventory, benefits, is_returnable, return_days, is_new, rating,
        title_i18n, description_i18n, tags_i18n, benefits_i18n,
        default_hsn_code, default_gst_rate, default_tax_applicable, default_price_includes_tax
    ) VALUES (
        COALESCE(p_product_data->>'title', ''),
        COALESCE(p_product_data->>'description', ''),
        COALESCE((p_product_data->>'price')::NUMERIC, 0),
        NULLIF(p_product_data->>'mrp', '')::NUMERIC,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'images', '[]'::jsonb))), '{}'),
        p_product_data->>'category',
        NULLIF(p_product_data->>'category_id', '')::UUID,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'tags', '[]'::jsonb))), '{}'),
        COALESCE((p_product_data->>'inventory')::INTEGER, 0),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'benefits', '[]'::jsonb))), '{}'),
        COALESCE((p_product_data->>'is_returnable')::BOOLEAN, true),
        COALESCE((p_product_data->>'return_days')::INTEGER, 3),
        COALESCE((p_product_data->>'is_new')::BOOLEAN, false),
        COALESCE((p_product_data->>'rating')::NUMERIC, 0),
        COALESCE(p_product_data->'title_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'description_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'tags_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'benefits_i18n', '{}'::jsonb),
        p_product_data->>'default_hsn_code',
        COALESCE((p_product_data->>'default_gst_rate')::NUMERIC, 0),
        COALESCE((p_product_data->>'default_tax_applicable')::BOOLEAN, false),
        COALESCE((p_product_data->>'default_price_includes_tax')::BOOLEAN, false)
    )
    RETURNING id INTO v_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        INSERT INTO public.product_variants (
            product_id, size_label, size_label_i18n, description, description_i18n,
            variant_image_url, sku, price, mrp, stock_quantity, is_default, is_active
        ) VALUES (
            v_product_id,
            v_variant->>'size_label',
            COALESCE(v_variant->'size_label_i18n', '{}'::jsonb),
            v_variant->>'description',
            COALESCE(v_variant->'description_i18n', '{}'::jsonb),
            v_variant->>'variant_image_url',
            v_variant->>'sku',
            COALESCE((v_variant->>'price')::NUMERIC, 0),
            NULLIF(v_variant->>'mrp', '')::NUMERIC,
            COALESCE((v_variant->>'stock_quantity')::INTEGER, 0),
            COALESCE((v_variant->>'is_default')::BOOLEAN, false),
            COALESCE((v_variant->>'is_active')::BOOLEAN, true)
        )
        RETURNING id INTO v_variant_id;
        v_variant_ids := array_append(v_variant_ids, v_variant_id);
    END LOOP;

    RETURN jsonb_build_object('id', v_product_id, 'variant_ids', v_variant_ids);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_product_with_variants(
    p_product_id UUID,
    p_product_data JSONB,
    p_variants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_variant JSONB;
    v_created UUID[] := '{}';
    v_updated UUID[] := '{}';
    v_variant_id UUID;
BEGIN
    UPDATE public.products
    SET
        title = COALESCE(p_product_data->>'title', title),
        description = COALESCE(p_product_data->>'description', description),
        price = COALESCE(NULLIF(p_product_data->>'price', '')::NUMERIC, price),
        mrp = COALESCE(NULLIF(p_product_data->>'mrp', '')::NUMERIC, mrp),
        category = COALESCE(p_product_data->>'category', category),
        category_id = COALESCE(NULLIF(p_product_data->>'category_id', '')::UUID, category_id),
        title_i18n = COALESCE(p_product_data->'title_i18n', title_i18n),
        description_i18n = COALESCE(p_product_data->'description_i18n', description_i18n),
        tags_i18n = COALESCE(p_product_data->'tags_i18n', tags_i18n),
        benefits_i18n = COALESCE(p_product_data->'benefits_i18n', benefits_i18n),
        default_hsn_code = COALESCE(p_product_data->>'default_hsn_code', default_hsn_code),
        default_gst_rate = COALESCE((p_product_data->>'default_gst_rate')::NUMERIC, default_gst_rate),
        default_tax_applicable = COALESCE((p_product_data->>'default_tax_applicable')::BOOLEAN, default_tax_applicable),
        default_price_includes_tax = COALESCE((p_product_data->>'default_price_includes_tax')::BOOLEAN, default_price_includes_tax),
        updated_at = NOW()
    WHERE id = p_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        IF NULLIF(v_variant->>'id', '') IS NOT NULL THEN
            UPDATE public.product_variants
            SET
                size_label = COALESCE(v_variant->>'size_label', size_label),
                size_label_i18n = COALESCE(v_variant->'size_label_i18n', size_label_i18n),
                description = COALESCE(v_variant->>'description', description),
                description_i18n = COALESCE(v_variant->'description_i18n', description_i18n),
                variant_image_url = COALESCE(v_variant->>'variant_image_url', variant_image_url),
                sku = COALESCE(v_variant->>'sku', sku),
                price = COALESCE(NULLIF(v_variant->>'price', '')::NUMERIC, price),
                mrp = COALESCE(NULLIF(v_variant->>'mrp', '')::NUMERIC, mrp),
                stock_quantity = COALESCE(NULLIF(v_variant->>'stock_quantity', '')::INTEGER, stock_quantity),
                is_default = COALESCE((v_variant->>'is_default')::BOOLEAN, is_default),
                is_active = COALESCE((v_variant->>'is_active')::BOOLEAN, is_active),
                updated_at = NOW()
            WHERE id = (v_variant->>'id')::UUID
            RETURNING id INTO v_variant_id;
            v_updated := array_append(v_updated, v_variant_id);
        ELSE
            INSERT INTO public.product_variants (
                product_id, size_label, size_label_i18n, description, description_i18n,
                variant_image_url, sku, price, mrp, stock_quantity, is_default, is_active
            ) VALUES (
                p_product_id,
                v_variant->>'size_label',
                COALESCE(v_variant->'size_label_i18n', '{}'::jsonb),
                v_variant->>'description',
                COALESCE(v_variant->'description_i18n', '{}'::jsonb),
                v_variant->>'variant_image_url',
                v_variant->>'sku',
                COALESCE((v_variant->>'price')::NUMERIC, 0),
                NULLIF(v_variant->>'mrp', '')::NUMERIC,
                COALESCE((v_variant->>'stock_quantity')::INTEGER, 0),
                COALESCE((v_variant->>'is_default')::BOOLEAN, false),
                COALESCE((v_variant->>'is_active')::BOOLEAN, true)
            )
            RETURNING id INTO v_variant_id;
            v_created := array_append(v_created, v_variant_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('id', p_product_id, 'new_variants', v_created, 'updated_variants', v_updated);
END;
$$;

-- ==========================================
-- 36. ORDER RPC
-- ==========================================

CREATE OR REPLACE FUNCTION public.create_order_transactional(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
    p_payment_id UUID,
    p_cart_id UUID,
    p_coupon_code TEXT,
    p_order_number TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_order_number TEXT;
BEGIN
    v_order_number := COALESCE(NULLIF(p_order_number, ''), public.generate_next_order_number());

    INSERT INTO public.orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address_id, billing_address_id, shipping_address, billing_address,
        total_amount, "totalAmount", subtotal, coupon_code, coupon_discount,
        delivery_charge, delivery_gst, status, payment_status, "paymentStatus",
        notes, items, metadata, is_delivery_refundable
    ) VALUES (
        v_order_number,
        p_user_id,
        p_order_data->>'customer_name',
        p_order_data->>'customer_email',
        p_order_data->>'customer_phone',
        NULLIF(p_order_data->>'shipping_address_id', '')::UUID,
        NULLIF(p_order_data->>'billing_address_id', '')::UUID,
        COALESCE(p_order_data->'shipping_address', '{}'::jsonb),
        COALESCE(p_order_data->'billing_address', '{}'::jsonb),
        COALESCE((p_order_data->>'total_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'subtotal')::NUMERIC, 0),
        p_coupon_code,
        COALESCE((p_order_data->>'coupon_discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        COALESCE(p_order_data->>'status', 'pending'),
        COALESCE(p_order_data->>'payment_status', 'pending'),
        COALESCE(p_order_data->>'payment_status', 'pending'),
        p_order_data->>'notes',
        COALESCE(p_order_items, '[]'::jsonb),
        COALESCE(p_order_data->'metadata', '{}'::jsonb),
        COALESCE((p_order_data->>'is_delivery_refundable')::BOOLEAN, true)
    )
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order_items, '[]'::jsonb))
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, variant_id, title, quantity, price_per_unit,
            mrp, is_returnable, delivery_charge, delivery_gst,
            delivery_calculation_snapshot, tax_snapshot
        ) VALUES (
            v_order_id,
            NULLIF(v_item->>'product_id', '')::UUID,
            NULLIF(v_item->>'variant_id', '')::UUID,
            v_item->>'title',
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->>'price_per_unit')::NUMERIC, COALESCE((v_item->>'price')::NUMERIC, 0)),
            NULLIF(v_item->>'mrp', '')::NUMERIC,
            COALESCE((v_item->>'is_returnable')::BOOLEAN, true),
            COALESCE((v_item->>'delivery_charge')::NUMERIC, 0),
            COALESCE((v_item->>'delivery_gst')::NUMERIC, 0),
            v_item->'delivery_calculation_snapshot',
            v_item->'tax_snapshot'
        );
    END LOOP;

    INSERT INTO public.order_status_history (order_id, status, updated_by, actor, notes)
    VALUES (v_order_id, 'ORDER_PLACED', p_user_id, 'SYSTEM', 'Order created transactionally');

    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments SET order_id = v_order_id, updated_at = NOW() WHERE id = p_payment_id;
    END IF;

    IF p_coupon_code IS NOT NULL THEN
        UPDATE public.coupons SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW() WHERE code = p_coupon_code;
    END IF;

    IF p_cart_id IS NOT NULL THEN
        DELETE FROM public.cart_items WHERE cart_id = p_cart_id;
        DELETE FROM public.carts WHERE id = p_cart_id;
    END IF;

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'status', COALESCE(p_order_data->>'status', 'pending'),
        'total_amount', COALESCE((p_order_data->>'total_amount')::NUMERIC, 0)
    );
END;
$$;

-- 36b. Checkout Prelim (v1)
-- Consolidates profile, cart, and next order number fetch
CREATE OR REPLACE FUNCTION public.checkout_prelim_v1(p_user_id UUID DEFAULT NULL, p_guest_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_profile JSONB;
    v_cart JSONB;
    v_order_number TEXT;
BEGIN
    -- 1. Fetch Profile (if user_id provided)
    IF p_user_id IS NOT NULL THEN
        SELECT to_jsonb(p.*) INTO v_profile FROM public.profiles p WHERE p.id = p_user_id;
    END IF;

    -- 2. Fetch Cart with Items joined with Products and Variants
    SELECT jsonb_build_object(
        'id', c.id,
        'applied_coupon_code', c.applied_coupon_code,
        'cart_items', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', ci.id,
                'quantity', ci.quantity,
                'product_id', ci.product_id,
                'variant_id', ci.variant_id,
                'products', to_jsonb(pr.*),
                'product_variants', to_jsonb(pv.*)
            )
        ) FILTER (WHERE ci.id IS NOT NULL), '[]'::jsonb)
    ) INTO v_cart
    FROM public.carts c
    LEFT JOIN public.cart_items ci ON c.id = ci.cart_id
    LEFT JOIN public.products pr ON ci.product_id = pr.id
    LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
    WHERE (p_user_id IS NOT NULL AND c.user_id = p_user_id)
       OR (p_user_id IS NULL AND p_guest_id IS NOT NULL AND c.guest_id = p_guest_id AND c.user_id IS NULL)
    GROUP BY c.id;

    -- 3. Generate Next Order Number
    SELECT public.generate_next_order_number() INTO v_order_number;

    RETURN jsonb_build_object(
        'profile', v_profile,
        'cart', v_cart,
        'next_order_number', v_order_number
    );
END;
$$;

-- 36c. Atomic Cart Upsert (v1)
-- Handles Stock Check + Cart Creation + Item Update in one round trip
CREATE OR REPLACE FUNCTION public.upsert_cart_item_v1(
    p_user_id UUID DEFAULT NULL,
    p_guest_id TEXT DEFAULT NULL,
    p_product_id UUID DEFAULT NULL,
    p_variant_id UUID DEFAULT NULL,
    p_quantity INTEGER DEFAULT 1,
    p_mode TEXT DEFAULT 'ADD' -- 'ADD' or 'SET'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cart_id UUID;
    v_available_stock INTEGER;
    v_current_qty INTEGER := 0;
    v_new_qty INTEGER;
    v_result JSONB;
BEGIN
    -- 1. Get or Create Cart
    SELECT id INTO v_cart_id FROM public.carts 
    WHERE (p_user_id IS NOT NULL AND user_id = p_user_id)
       OR (p_user_id IS NULL AND p_guest_id IS NOT NULL AND guest_id = p_guest_id AND user_id IS NULL);
       
    IF v_cart_id IS NULL THEN
        INSERT INTO public.carts (user_id, guest_id) 
        VALUES (p_user_id, p_guest_id) 
        RETURNING id INTO v_cart_id;
    END IF;

    -- 2. Check Stock
    IF p_variant_id IS NOT NULL THEN
        SELECT stock_quantity INTO v_available_stock FROM public.product_variants WHERE id = p_variant_id;
    ELSE
        SELECT inventory INTO v_available_stock FROM public.products WHERE id = p_product_id;
    END IF;

    IF v_available_stock IS NULL THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND';
    END IF;

    -- 3. Get Current Quantity in Cart
    SELECT quantity INTO v_current_qty FROM public.cart_items 
    WHERE cart_id = v_cart_id AND product_id = p_product_id 
      AND (p_variant_id IS NOT NULL AND variant_id = p_variant_id OR p_variant_id IS NULL AND variant_id IS NULL);

    IF p_mode = 'ADD' THEN
        v_new_qty := COALESCE(v_current_qty, 0) + p_quantity;
    ELSE
        v_new_qty := p_quantity;
    END IF;

    IF v_new_qty > v_available_stock THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK';
    END IF;

    IF v_new_qty <= 0 THEN
        DELETE FROM public.cart_items 
        WHERE cart_id = v_cart_id AND product_id = p_product_id 
          AND (p_variant_id IS NOT NULL AND variant_id = p_variant_id OR p_variant_id IS NULL AND variant_id IS NULL);
    ELSE
        INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity)
        VALUES (v_cart_id, p_product_id, p_variant_id, v_new_qty)
        ON CONFLICT (cart_id, product_id, variant_id) 
        DO UPDATE SET quantity = EXCLUDED.quantity, added_at = NOW();
    END IF;

    -- 4. Return Updated Cart
    SELECT jsonb_build_object(
        'id', c.id,
        'applied_coupon_code', c.applied_coupon_code,
        'cart_items', COALESCE(jsonb_agg(
            jsonb_build_object(
                'id', ci.id,
                'quantity', ci.quantity,
                'product_id', ci.product_id,
                'variant_id', ci.variant_id,
                'products', to_jsonb(pr.*),
                'product_variants', to_jsonb(pv.*)
            )
        ) FILTER (WHERE ci.id IS NOT NULL), '[]'::jsonb)
    ) INTO v_result
    FROM public.carts c
    LEFT JOIN public.cart_items ci ON c.id = ci.cart_id
    LEFT JOIN public.products pr ON ci.product_id = pr.id
    LEFT JOIN public.product_variants pv ON ci.variant_id = pv.id
    WHERE c.id = v_cart_id
    GROUP BY c.id;

    RETURN v_result;
END;
$$;

-- ==========================================
-- 37. DONATION RPCs
-- ==========================================

CREATE OR REPLACE FUNCTION public.create_subscription_transactional(
    p_user_id UUID, p_donation_ref TEXT, p_razorpay_subscription_id TEXT,
    p_razorpay_plan_id TEXT, p_amount NUMERIC, p_donor_name TEXT,
    p_donor_email TEXT, p_donor_phone TEXT, p_is_anonymous BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_donation_id UUID; v_subscription_id UUID;
BEGIN
    INSERT INTO public.donations (
        user_id, donation_reference_id, amount, donor_name, donor_email,
        donor_phone, is_anonymous, donation_type, payment_status, status
    ) VALUES (
        p_user_id, p_donation_ref, COALESCE(p_amount, 0), p_donor_name, p_donor_email,
        p_donor_phone, COALESCE(p_is_anonymous, false), 'MONTHLY', 'created', 'pending'
    ) RETURNING id INTO v_donation_id;

    INSERT INTO public.donation_subscriptions (
        user_id, donation_id, donation_reference_id, razorpay_subscription_id,
        razorpay_plan_id, amount, status
    ) VALUES (
        p_user_id, v_donation_id, p_donation_ref, p_razorpay_subscription_id,
        p_razorpay_plan_id, COALESCE(p_amount, 0), 'created'
    ) RETURNING id INTO v_subscription_id;

    RETURN jsonb_build_object('donation_id', v_donation_id, 'subscription_id', v_subscription_id, 'donation_reference_id', p_donation_ref);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_subscription_status_transactional(
    p_razorpay_subscription_id TEXT, p_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_row public.donation_subscriptions;
BEGIN
    UPDATE public.donation_subscriptions SET status = p_status, updated_at = NOW()
    WHERE razorpay_subscription_id = p_razorpay_subscription_id
    RETURNING * INTO v_row;
    RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_donation_transactional(
    p_razorpay_order_id TEXT, p_razorpay_payment_id TEXT, p_payment_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_donation public.donations;
BEGIN
    UPDATE public.donations
    SET razorpay_payment_id = p_razorpay_payment_id,
        payment_status = p_payment_status,
        status = CASE WHEN p_payment_status = 'success' THEN 'completed' ELSE status END,
        updated_at = NOW()
    WHERE razorpay_order_id = p_razorpay_order_id
    RETURNING * INTO v_donation;
    RETURN jsonb_build_object('donation', to_jsonb(v_donation));
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_event_registration_transactional(
    p_registration_id UUID, p_razorpay_payment_id TEXT,
    p_razorpay_signature TEXT, p_invoice_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql SET search_path = public
AS $$
DECLARE v_registration public.event_registrations;
BEGIN
    UPDATE public.event_registrations
    SET razorpay_payment_id = p_razorpay_payment_id,
        razorpay_signature = p_razorpay_signature,
        invoice_url = COALESCE(p_invoice_url, invoice_url),
        payment_status = 'captured', status = 'confirmed', updated_at = NOW()
    WHERE id = p_registration_id
    RETURNING * INTO v_registration;
    RETURN jsonb_build_object('registration', to_jsonb(v_registration));
END;
$$;

-- ==========================================
-- 38. COMMENT RPCs
-- ==========================================

CREATE OR REPLACE FUNCTION public.check_comment_rate_limit(
    p_user_id UUID, p_blog_id UUID, p_max_comments INTEGER DEFAULT 5
) RETURNS TABLE (is_allowed BOOLEAN, comments_remaining INTEGER, window_resets_at TIMESTAMPTZ, current_count INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_rec RECORD;
BEGIN
    SELECT * INTO v_rec FROM public.comment_rate_limits
    WHERE user_id = p_user_id AND blog_id = p_blog_id AND window_end > NOW()
    ORDER BY window_start DESC LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT true, p_max_comments, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        (v_rec.comment_count < p_max_comments),
        GREATEST(p_max_comments - v_rec.comment_count, 0),
        v_rec.window_end,
        v_rec.comment_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_threaded_comments(p_blog_id UUID)
RETURNS JSONB
LANGUAGE sql STABLE SET search_path = public
AS $$
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.created_at ASC), '[]'::jsonb)
    FROM public.comments c WHERE c.blog_id = p_blog_id AND c.status = 'active';
$$;

-- ==========================================
-- 39. CART RPC
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_or_create_cart(p_user_id UUID)
RETURNS UUID AS $$
DECLARE v_cart_id UUID;
BEGIN
    INSERT INTO public.carts (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT id INTO v_cart_id FROM public.carts WHERE user_id = p_user_id;
    RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION merge_guest_into_user_cart(p_user_id uuid, p_guest_id text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
    v_user_cart_id uuid;
    v_guest_cart_id uuid;
    v_item RECORD;
BEGIN
    INSERT INTO carts (user_id) VALUES (p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_user_cart_id;

    SELECT id INTO v_guest_cart_id FROM carts WHERE guest_id = p_guest_id LIMIT 1;

    IF v_guest_cart_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'merged', false, 'cart_id', v_user_cart_id);
    END IF;

    FOR v_item IN SELECT product_id, variant_id, quantity FROM cart_items WHERE cart_id = v_guest_cart_id LOOP
        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
        VALUES (v_user_cart_id, v_item.product_id, v_item.variant_id, v_item.quantity)
        ON CONFLICT (cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity, updated_at = NOW();
    END LOOP;

    UPDATE carts u SET applied_coupon_code = g.applied_coupon_code
    FROM carts g
    WHERE u.id = v_user_cart_id AND g.id = v_guest_cart_id
    AND u.applied_coupon_code IS NULL AND g.applied_coupon_code IS NOT NULL;

    DELETE FROM cart_items WHERE cart_id = v_guest_cart_id;
    DELETE FROM carts WHERE id = v_guest_cart_id;

    RETURN jsonb_build_object('success', true, 'merged', true, 'cart_id', v_user_cart_id);
END;
$$;

-- ==========================================
-- 40. DASHBOARD RPC
-- ==========================================

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats_v3(
    p_from TIMESTAMPTZ DEFAULT NULL, p_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
    v_from TIMESTAMPTZ := COALESCE(p_from, '1970-01-01'::timestamptz);
    v_to TIMESTAMPTZ := COALESCE(p_to, NOW());
BEGIN
    RETURN jsonb_build_object(
        'orders', (SELECT COUNT(*) FROM public.orders WHERE created_at BETWEEN v_from AND v_to),
        'products', (SELECT COUNT(*) FROM public.products),
        'customers', (SELECT COUNT(*) FROM public.profiles p JOIN public.roles r ON r.id = p.role_id WHERE r.name = 'customer'),
        'donations', (SELECT COALESCE(SUM(amount), 0) FROM public.donations WHERE payment_status = 'success' AND created_at BETWEEN v_from AND v_to),
        'grossRevenue', (
            SELECT COALESCE(SUM(total_amount), 0) FROM public.orders
            WHERE COALESCE(payment_status, status) IN ('paid', 'captured', 'completed', 'delivered')
              AND created_at BETWEEN v_from AND v_to
        ),
        'netRevenue', (
            SELECT
                COALESCE((SELECT SUM(o.total_amount) FROM public.orders o
                    WHERE COALESCE(o.payment_status, o.status) IN ('paid', 'captured', 'completed', 'delivered')
                      AND o.created_at BETWEEN v_from AND v_to), 0)
                -
                COALESCE((SELECT SUM(r.amount) FROM public.refunds r
                    WHERE COALESCE(r.status, '') IN ('processed', 'completed', 'refunded')
                      AND r.created_at BETWEEN v_from AND v_to), 0)
        ),
        'events', (SELECT COUNT(*) FROM public.events),
        'returns', (SELECT COUNT(*) FROM public.returns)
    );
END;
$$;

-- ==========================================
-- 41. ORDER SUMMARY STATS RPC
-- ==========================================

CREATE OR REPLACE FUNCTION get_order_summary_stats_v2()
RETURNS json AS $$
DECLARE
    result json;
    refunded_orders record;
    refunded_cancelled_count int := 0;
    refunded_returned_count int := 0;
BEGIN
    WITH counts AS (
        SELECT
            (SELECT count(*) FROM public.orders) as total_orders,
            (SELECT count(*) FROM public.orders WHERE status IN ('pending', 'confirmed')) as new_orders,
            (SELECT count(*) FROM public.orders WHERE status IN ('processing', 'packed', 'shipped', 'out_for_delivery', 'return_approved', 'return_picked_up')) as processing_orders,
            (SELECT count(*) FROM public.orders WHERE status = 'cancelled') as cancelled_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status IN ('returned', 'partially_returned', 'partially_refunded')) as returned_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status = 'delivery_unsuccessful' OR delivery_unsuccessful_reason IS NOT NULL) as delivery_failed,
            (SELECT count(*) FROM public.orders WHERE payment_status = 'failed') as payment_failed,
            (SELECT count(*) FROM public.orders WHERE status = 'return_requested') as return_requested_orders
    )
    SELECT json_build_object(
        'totalOrders', c.total_orders, 'newOrders', c.new_orders,
        'processingOrders', c.processing_orders, 'cancelledOrdersRaw', c.cancelled_orders_raw,
        'returnedOrdersRaw', c.returned_orders_raw, 'deliveryFailed', c.delivery_failed,
        'paymentFailed', c.payment_failed, 'returnRequestedOrders', c.return_requested_orders
    ) INTO result FROM counts c;

    FOR refunded_orders IN
        SELECT id, (SELECT count(*) FROM public.returns r WHERE r.order_id = o.id) > 0 as has_return
        FROM public.orders o WHERE status = 'refunded'
    LOOP
        IF refunded_orders.has_return THEN refunded_returned_count := refunded_returned_count + 1;
        ELSE refunded_cancelled_count := refunded_cancelled_count + 1; END IF;
    END LOOP;

    result := result::jsonb || jsonb_build_object(
        'cancelledOrders', (result->>'cancelledOrdersRaw')::int + refunded_cancelled_count,
        'returnedOrders', (result->>'returnedOrdersRaw')::int + refunded_returned_count,
        'failedOrders', (result->>'deliveryFailed')::int + (result->>'paymentFailed')::int
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 42. PRODUCT DETAIL RPC
-- ==========================================

CREATE OR REPLACE FUNCTION get_product_detail_consolidated(p_id uuid)
RETURNS json AS $$
DECLARE v_product json; v_variants json; v_configs json;
BEGIN
    SELECT row_to_json(p) INTO v_product FROM (
        SELECT *,
            (SELECT COALESCE(count(*), 0) FROM reviews r WHERE r.product_id = products.id) as "reviewCount",
            (SELECT COALESCE(count(*), 0) FROM reviews r WHERE r.product_id = products.id AND r.rating IS NOT NULL) as "ratingCount"
        FROM products WHERE id = p_id
    ) p;
    IF v_product IS NULL THEN RETURN NULL; END IF;

    SELECT json_agg(row_to_json(v.*)) INTO v_variants FROM public.product_variants v WHERE v.product_id = p_id;
    SELECT json_agg(row_to_json(c.*)) INTO v_configs FROM public.delivery_configs c
    WHERE c.is_active = true AND (c.product_id = p_id OR c.variant_id IN (SELECT id FROM public.product_variants WHERE product_id = p_id));

    RETURN json_build_object('product', v_product, 'variants', COALESCE(v_variants, '[]'::json), 'deliveryConfigs', COALESCE(v_configs, '[]'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 43. REVIEWS RPC
-- ==========================================

CREATE OR REPLACE FUNCTION get_product_reviews_paginated_v2(
    p_product_id uuid, p_page int DEFAULT 1, p_limit int DEFAULT 5
) RETURNS json AS $$
DECLARE v_reviews json; v_total_count int; v_distribution json;
BEGIN
    SELECT count(*) INTO v_total_count FROM public.reviews WHERE product_id = p_product_id;
    SELECT json_agg(r) INTO v_reviews FROM (
        SELECT rev.id, rev.product_id, rev.user_id, rev.rating, rev.title, rev.comment,
               rev.is_verified, rev.created_at, p.name as user_name, p.avatar_url as user_avatar
        FROM public.reviews rev LEFT JOIN public.profiles p ON rev.user_id = p.id
        WHERE rev.product_id = p_product_id ORDER BY rev.created_at DESC
        LIMIT p_limit OFFSET (p_page - 1) * p_limit
    ) r;
    SELECT json_object_agg(rating, count) INTO v_distribution FROM (
        SELECT rating, count(*) as count FROM public.reviews WHERE product_id = p_product_id GROUP BY rating
    ) s;
    RETURN json_build_object('reviews', COALESCE(v_reviews, '[]'::json), 'totalCount', v_total_count, 'distribution', COALESCE(v_distribution, '{}'::json));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 44. PAGINATION RPCs
-- ==========================================

-- Products Paginated v3
DROP FUNCTION IF EXISTS get_products_paginated_v3(int, int, text, text, text, text);
CREATE OR REPLACE FUNCTION get_products_paginated_v3(
    p_page int DEFAULT 1, p_limit int DEFAULT 10, p_search text DEFAULT '',
    p_category text DEFAULT 'all', p_sort_by text DEFAULT 'newest', p_lang text DEFAULT 'en'
) RETURNS jsonb AS $$
DECLARE v_offset int; v_data jsonb; v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    SELECT count(*) INTO v_total FROM public.products
    WHERE (p_category = 'all' OR category_id::text = p_category OR category = p_category)
    AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%');

    WITH result_set AS (
        SELECT p.id, p.price, p.mrp, p.inventory, p.rating, p."ratingCount", p."reviewCount", p.created_at,
            p.is_new, p.tags, p.variant_mode, p.is_returnable, p.return_days,
            p.category, p.category_id, p.images,
            p.default_hsn_code, p.default_gst_rate, p.default_tax_applicable, p.default_price_includes_tax,
            COALESCE(p.title_i18n->>p_lang, p.title) as title, p.title_i18n,
            COALESCE(p.description_i18n->>p_lang, p.description) as description, p.description_i18n,
            p.tags_i18n, p.benefits, p.benefits_i18n,
            COALESCE(p.images[1], '') as primary_image,
            (SELECT jsonb_agg(v.*) FROM public.product_variants v WHERE v.product_id = p.id) as variants
        FROM public.products p
        WHERE (p_category = 'all' OR category_id::text = p_category OR category = p_category)
        AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        ORDER BY
            CASE WHEN p_sort_by = 'priceLowHigh' THEN price END ASC,
            CASE WHEN p_sort_by = 'priceHighLow' THEN price END DESC,
            CASE WHEN p_sort_by = 'reviewCount' THEN "reviewCount" END DESC,
            CASE WHEN p_sort_by = 'newest' THEN created_at END DESC NULLS LAST
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object('products', COALESCE(v_data, '[]'::jsonb), 'total', v_total, 'page', p_page, 'limit', p_limit, 'totalPages', CEIL(v_total::float / p_limit));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Blogs Paginated
DROP FUNCTION IF EXISTS get_blogs_paginated(int, int, text, text);
CREATE OR REPLACE FUNCTION get_blogs_paginated(
    p_page int DEFAULT 1, p_limit int DEFAULT 10, p_search text DEFAULT '', p_lang text DEFAULT 'en'
) RETURNS jsonb AS $$
DECLARE v_offset int; v_data jsonb; v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;
    SELECT count(*) INTO v_total FROM blogs WHERE published = true
    AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR content ILIKE '%' || p_search || '%');

    WITH result_set AS (
        SELECT id, image, created_at, blog_code as slug,
            COALESCE(author_i18n->>p_lang, author) as author, date,
            COALESCE(tags_i18n->p_lang, to_jsonb(tags)) as tags,
            COALESCE(title_i18n->>p_lang, title) as title,
            COALESCE(excerpt_i18n->>p_lang, excerpt) as excerpt
        FROM blogs WHERE published = true
        AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR content ILIKE '%' || p_search || '%')
        ORDER BY date DESC, created_at DESC LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object('blogs', COALESCE(v_data, '[]'::jsonb), 'total', v_total, 'page', p_page, 'limit', p_limit, 'totalPages', CEIL(v_total::float / p_limit));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Events Paginated
DROP FUNCTION IF EXISTS get_events_paginated(int, int, text, text, text);
CREATE OR REPLACE FUNCTION get_events_paginated(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 10,
    p_search text DEFAULT '',
    p_status text DEFAULT 'all',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
    v_now timestamp with time zone := NOW();
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Fetch Total Count
    SELECT count(*) INTO v_total
    FROM public.events
    WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
    AND (
        p_status = 'all' OR
        (p_status = 'upcoming' AND start_date > v_now) OR
        (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
        (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
    );

    -- Fetch Data
    WITH result_set AS (
        SELECT 
            e.id, 
            REPLACE(REPLACE(e.image, '/event_images/', '/event-media/'), '/events/', '/event-media/') as image, 
            e.start_date, e.end_date, e.start_time, e.end_time, e.location, e.registrations, e.event_code as slug,
            e.status, e.cancellation_status,
            COALESCE(e.title_i18n->>p_lang, e.title) as title,
            COALESCE(e.description_i18n->>p_lang, e.description) as description,
            (SELECT jsonb_build_object('name', COALESCE(c.name_i18n->>p_lang, c.name)) FROM categories c WHERE c.name = e.category AND c.type = 'event' LIMIT 1) as category_data
        FROM public.events e
        WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        AND (
            p_status = 'all' OR
            (p_status = 'upcoming' AND start_date > v_now) OR
            (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
            (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
        )
        ORDER BY start_date ASC
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'events', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- FAQs v2
DROP FUNCTION IF EXISTS get_faqs_v2(text, uuid);
CREATE OR REPLACE FUNCTION get_faqs_v2(p_lang text DEFAULT 'en', p_category_id uuid DEFAULT NULL)
RETURNS jsonb AS $$
DECLARE v_data jsonb;
BEGIN
    SELECT json_agg(f) INTO v_data FROM (
        SELECT f.id, f.display_order,
            COALESCE(f.question_i18n->>p_lang, f.question) as question,
            COALESCE(f.answer_i18n->>p_lang, f.answer) as answer,
            (SELECT jsonb_build_object('id', c.id, 'name', COALESCE(c.name_i18n->>p_lang, c.name)) FROM categories c WHERE c.id = f.category_id) as category
        FROM faqs f WHERE f.is_active = true AND (p_category_id IS NULL OR f.category_id = p_category_id)
        ORDER BY f.display_order ASC
    ) f;
    RETURN COALESCE(v_data, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 45. SITE CONTENT v2 RPC
-- ==========================================

DROP FUNCTION IF EXISTS get_site_content_v2(text);
CREATE OR REPLACE FUNCTION get_site_content_v2(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE v_now timestamp with time zone := NOW();
BEGIN
    RETURN jsonb_build_object(
        'settings', (SELECT jsonb_object_agg(key, value) FROM store_settings),
        'categories', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', COALESCE(name_i18n->>p_lang, name), 'type', type)), '[]'::jsonb) FROM categories),
        'policies', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'slug', type, 'title', COALESCE(title_i18n->>p_lang, title))), '[]'::jsonb) FROM policy_pages),
        'socialMedia', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'platform', platform, 'url', url, 'icon', icon)), '[]'::jsonb) FROM social_media WHERE is_active = true ORDER BY display_order),
        'bankDetails', (SELECT COALESCE(jsonb_agg(b.*), '[]'::jsonb) FROM (SELECT * FROM bank_details WHERE is_active = true ORDER BY display_order) b),
        'contactInfo', (SELECT jsonb_build_object(
            'address', (SELECT to_jsonb(ci.*) FROM contact_info ci LIMIT 1),
            'phones', (SELECT COALESCE(jsonb_agg(cp.*), '[]'::jsonb) FROM (SELECT * FROM contact_phones WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) cp),
            'emails', (SELECT COALESCE(jsonb_agg(ce.*), '[]'::jsonb) FROM (SELECT * FROM contact_emails WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) ce),
            'officeHours', (SELECT COALESCE(jsonb_agg(coh.*), '[]'::jsonb) FROM (SELECT * FROM contact_office_hours ORDER BY display_order ASC) coh)
        )),
        'about', (SELECT jsonb_build_object('footerDescription', footer_description) FROM about_settings LIMIT 1),
        'coupons', (SELECT COALESCE(jsonb_agg(c.*), '[]'::jsonb) FROM coupons c WHERE is_active = true AND valid_from <= v_now AND (valid_until IS NULL OR valid_until >= v_now) AND (usage_limit IS NULL OR usage_count < usage_limit)),
        'brandAssets', (SELECT COALESCE(jsonb_object_agg(key, url), '{}'::jsonb) FROM brand_assets)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 45b. Bulk Reorder FAQs (v1)
CREATE OR REPLACE FUNCTION public.reorder_faqs_v1(p_faq_ids UUID[])
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    FOR i IN 1 .. array_length(p_faq_ids, 1) LOOP
        UPDATE public.faqs
        SET display_order = i - 1,
            updated_at = NOW()
        WHERE id = p_faq_ids[i];
    END LOOP;
END;
$$;

-- ==========================================
-- 46. APP INIT PAYLOAD v4 RPC (Latest)
-- ==========================================

DROP FUNCTION IF EXISTS get_app_initial_payload_v4(text);
CREATE OR REPLACE FUNCTION get_app_initial_payload_v4(p_lang text DEFAULT 'en')
RETURNS jsonb AS $$
DECLARE
    v_site_content jsonb;
    v_homepage jsonb;
    v_now timestamp with time zone := NOW();
BEGIN
    v_site_content := (
        SELECT jsonb_build_object(
            'settings', (SELECT jsonb_object_agg(key, value) FROM store_settings),
            'categories', (SELECT jsonb_agg(jsonb_build_object('id', id, 'name', COALESCE(name_i18n->>p_lang, name), 'type', type)) FROM categories),
            'policies', (SELECT jsonb_agg(jsonb_build_object('id', id, 'slug', type, 'title', COALESCE(title_i18n->>p_lang, title))) FROM policy_pages),
            'socialMedia', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'platform', platform, 'url', url, 'icon', icon)), '[]'::jsonb) FROM social_media WHERE is_active = true ORDER BY display_order),
            'bankDetails', (SELECT COALESCE(jsonb_agg(b.*), '[]'::jsonb) FROM (SELECT * FROM bank_details WHERE is_active = true ORDER BY display_order) b),
            'contactInfo', (SELECT jsonb_build_object(
                'address', (SELECT to_jsonb(ci.*) FROM contact_info ci LIMIT 1),
                'phones', (SELECT COALESCE(jsonb_agg(cp.*), '[]'::jsonb) FROM (SELECT * FROM contact_phones WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) cp),
                'emails', (SELECT COALESCE(jsonb_agg(ce.*), '[]'::jsonb) FROM (SELECT * FROM contact_emails WHERE is_active = true ORDER BY is_primary DESC, display_order ASC) ce),
                'officeHours', (SELECT COALESCE(jsonb_agg(coh.*), '[]'::jsonb) FROM (SELECT * FROM contact_office_hours ORDER BY display_order ASC) coh)
            )),
            'about', (SELECT jsonb_build_object('footerDescription', footer_description) FROM about_settings LIMIT 1),
            'coupons', (SELECT COALESCE(jsonb_agg(c.*), '[]'::jsonb) FROM coupons c WHERE is_active = true AND valid_from <= v_now AND (valid_until IS NULL OR valid_until >= v_now) AND (usage_limit IS NULL OR usage_count < usage_limit)),
            'brandAssets', (SELECT COALESCE(jsonb_object_agg(key, url), '{}'::jsonb) FROM brand_assets)
        )
    );

    v_homepage := (
        SELECT jsonb_build_object(
            'carouselSlides', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', gi.id, 'title', COALESCE(gi.title_i18n->>p_lang, gi.title),
                    'subtitle', COALESCE(gi.description_i18n->>p_lang, gi.description),
                    'image', gi.image_url, 'order', gi.order_index
                )), '[]'::jsonb)
                FROM gallery_items gi JOIN gallery_folders gf ON gf.id = gi.folder_id
                WHERE gf.is_home_carousel = true AND gf.is_active = true
                ORDER BY gi.order_index ASC
            ),
            'mobileCarouselSlides', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                    'id', gi.id, 'title', COALESCE(gi.title_i18n->>p_lang, gi.title),
                    'subtitle', COALESCE(gi.description_i18n->>p_lang, gi.description),
                    'image', gi.image_url, 'order', gi.order_index
                )), '[]'::jsonb)
                FROM gallery_items gi JOIN gallery_folders gf ON gf.id = gi.folder_id
                WHERE gf.is_mobile_carousel = true AND gf.is_active = true
                ORDER BY gi.order_index ASC
            ),
            'products', (
                SELECT COALESCE(jsonb_agg(p), '[]'::jsonb) FROM (
                    SELECT id, price, mrp, rating, "ratingCount", "reviewCount", created_at,
                        is_new, tags, variant_mode, is_returnable, return_days,
                        category, category_id, images,
                        default_hsn_code, default_gst_rate, default_tax_applicable, default_price_includes_tax,
                        COALESCE(title_i18n->>p_lang, title) as title, title_i18n,
                        COALESCE(description_i18n->>p_lang, description) as description, description_i18n,
                        tags_i18n, benefits, benefits_i18n,
                        COALESCE(images[1], '') as primary_image
                    FROM products WHERE is_active = true ORDER BY created_at DESC LIMIT 10
                ) p
            ),
            'blogs', (
                SELECT COALESCE(jsonb_agg(b), '[]'::jsonb) FROM (
                    SELECT id, image, blog_code as slug, created_at,
                        COALESCE(title_i18n->>p_lang, title) as title,
                        COALESCE(excerpt_i18n->>p_lang, excerpt) as excerpt
                    FROM blogs WHERE published = true ORDER BY created_at DESC LIMIT 10
                ) b
            ),
            'events', (
                SELECT COALESCE(jsonb_agg(e), '[]'::jsonb) FROM (
                    SELECT id, image, event_code as slug, start_date, location,
                        COALESCE(title_i18n->>p_lang, title) as title,
                        COALESCE(description_i18n->>p_lang, description) as description
                    FROM events
                    WHERE status NOT IN ('cancelled', 'completed')
                      AND (end_date >= v_now OR (end_date IS NULL AND start_date >= v_now - interval '1 day'))
                    ORDER BY start_date ASC LIMIT 10
                ) e
            ),
            'testimonials', (
                SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
                    SELECT id, rating, name, image,
                        COALESCE(content_i18n->>p_lang, content) as content
                    FROM testimonials WHERE approved = true ORDER BY created_at DESC LIMIT 10
                ) t
            ),
            'galleryItems', (
                SELECT COALESCE(jsonb_agg(g), '[]'::jsonb) FROM (
                    SELECT id, COALESCE(image_url, image_url) as image, title
                    FROM gallery_items ORDER BY created_at DESC LIMIT 12
                ) g
            )
        )
    );

    RETURN jsonb_build_object('siteContent', v_site_content, 'homepage', v_homepage, 'timestamp', v_now);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==========================================
-- 47. CODE GENERATION FUNCTIONS & TRIGGERS
-- ==========================================

CREATE OR REPLACE FUNCTION public.generate_product_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.code := 'PRD-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_category_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.category_code := 'CAT-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_event_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.event_code := 'EVT-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.generate_blog_code()
RETURNS TRIGGER AS $$
BEGIN
    NEW.blog_code := 'BLG-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_category_code') THEN
        CREATE TRIGGER trigger_generate_category_code
            BEFORE INSERT ON public.categories
            FOR EACH ROW
            WHEN (NEW.category_code IS NULL)
            EXECUTE FUNCTION public.generate_category_code();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_event_code') THEN
        CREATE TRIGGER trigger_generate_event_code
            BEFORE INSERT ON public.events
            FOR EACH ROW
            WHEN (NEW.event_code IS NULL)
            EXECUTE FUNCTION public.generate_event_code();
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_blog_code') THEN
        CREATE TRIGGER trigger_generate_blog_code
            BEFORE INSERT ON public.blogs
            FOR EACH ROW
            WHEN (NEW.blog_code IS NULL)
            EXECUTE FUNCTION public.generate_blog_code();
    END IF;
END $$;

-- ==========================================
-- 48. HANDLE NEW USER (Auth Trigger)
-- ==========================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INTEGER;
    meta_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
BEGIN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer';
    meta_name := NEW.raw_user_meta_data->>'name';

    IF meta_name IS NOT NULL AND length(meta_name) > 0 THEN
        user_first_name := split_part(meta_name, ' ', 1);
        IF position(' ' in meta_name) > 0 THEN
             user_last_name := substring(meta_name from position(' ' in meta_name) + 1);
        ELSE
             user_last_name := NULL;
        END IF;
    ELSE
        user_first_name := split_part(NEW.email, '@', 1);
        user_last_name := NULL;
    END IF;

    INSERT INTO public.profiles (
        id, email, name, phone, role_id, created_at, updated_at,
        email_verified, phone_verified, is_deleted, is_blocked, first_name, last_name
    ) VALUES (
        NEW.id, NEW.email, COALESCE(meta_name, NEW.email),
        NEW.raw_user_meta_data->>'phone', default_role_id,
        NOW(), NOW(), (NEW.email_confirmed_at IS NOT NULL),
        (NEW.phone_confirmed_at IS NOT NULL), false, false,
        user_first_name, user_last_name
    ) ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
BEGIN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
        AFTER INSERT ON auth.users
        FOR EACH ROW
        EXECUTE FUNCTION public.handle_new_user();
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Could not manage trigger on auth.users (skipping): %', SQLERRM;
END $$;

-- Backfill missing profiles
INSERT INTO public.profiles (id, email, name, role_id, created_at, updated_at, is_deleted, is_blocked, first_name, last_name)
SELECT au.id, au.email,
    COALESCE(au.raw_user_meta_data->>'name', au.email),
    (SELECT id FROM public.roles WHERE name = 'customer'),
    au.created_at, NOW(), false, false,
    COALESCE(NULLIF(split_part(au.raw_user_meta_data->>'name', ' ', 1), ''), split_part(au.email, '@', 1)),
    CASE WHEN position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) > 0
        THEN substring(COALESCE(au.raw_user_meta_data->>'name', '') from position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) + 1)
        ELSE NULL END
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;

-- ==========================================
-- 49. STORAGE BUCKETS (11 Granular Buckets)
-- ==========================================

-- ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY; -- Commented out to avoid 'must be owner' error in restricted Supabase environments.

DO $$
DECLARE
    bucket_list TEXT[] := ARRAY[
        'gallery-media', 'product-media', 'event-media', 'blog-media',
        'team-media', 'testimonial-media', 'profile-images', 'media-assets',
        'return-request-media', 'policy-documents', 'invoice-documents'
    ];
    b TEXT;
    is_public BOOLEAN;
    size_limit BIGINT := 5242880; -- 5MB
BEGIN
    FOREACH b IN ARRAY bucket_list LOOP
        is_public := NOT (b IN ('return-request-media', 'invoice-documents', 'profile-images'));
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (b, b, is_public, size_limit,
            CASE
                WHEN b IN ('policy-documents', 'invoice-documents') THEN
                    ARRAY['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
                ELSE
                    ARRAY['image/jpeg', 'image/jpg', 'image/pjpeg', 'image/png', 'image/x-png', 'image/webp', 'image/gif', 'image/svg+xml']
            END
        )
        ON CONFLICT (id) DO UPDATE
        SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
    END LOOP;
END $$;

-- Storage Admin Helper
CREATE OR REPLACE FUNCTION public.is_storage_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles p
    JOIN public.roles r ON p.role_id = r.id
    WHERE p.id = (select auth.uid())
    AND r.name IN ('admin', 'manager')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Storage RLS Policies
DO $$
DECLARE
    bucket_list TEXT[] := ARRAY[
        'gallery-media', 'product-media', 'event-media', 'blog-media',
        'team-media', 'testimonial-media', 'profile-images', 'media-assets',
        'return-request-media', 'policy-documents', 'invoice-documents'
    ];
    b TEXT;
BEGIN
    FOREACH b IN ARRAY bucket_list LOOP
        -- Safeguard all storage policy operations in a sub-block
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', 'Public Read ' || b);

            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin Manage All Objects') THEN
                EXECUTE 'CREATE POLICY "Admin Manage All Objects" ON storage.objects
                FOR ALL TO authenticated
                USING (public.is_storage_admin_or_manager())
                WITH CHECK (public.is_storage_admin_or_manager())';
            END IF;

            -- Public read access is handled by the bucket's public flag.
            -- We avoid broad SELECT policies on storage.objects to prevent unauthorized bucket listing.
            -- IF b NOT IN ('return-request-media', 'invoice-documents') THEN
            --     EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO public USING (bucket_id = %L)', 'Public Read ' || b, b);
            -- END IF;

            IF b = 'profile-images' THEN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Avatar Management') THEN
                    EXECUTE 'CREATE POLICY "User Avatar Management" ON storage.objects
                    FOR ALL TO authenticated
                    USING (bucket_id = ''profile-images'' AND (select auth.uid())::text = (storage.foldername(name))[1])
                    WITH CHECK (bucket_id = ''profile-images'' AND (select auth.uid())::text = (storage.foldername(name))[1])';
                END IF;
            END IF;

            IF b = 'return-request-media' THEN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Return Proof Management') THEN
                    EXECUTE 'CREATE POLICY "User Return Proof Management" ON storage.objects
                    FOR ALL TO authenticated
                    USING (bucket_id = ''return-request-media'' AND (select auth.uid())::text = (storage.foldername(name))[1])
                    WITH CHECK (bucket_id = ''return-request-media'' AND (select auth.uid())::text = (storage.foldername(name))[1])';
                END IF;
            END IF;

            IF b = 'invoice-documents' THEN
                IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'User Invoice View') THEN
                    EXECUTE 'CREATE POLICY "User Invoice View" ON storage.objects
                    FOR SELECT TO authenticated
                    USING (bucket_id = ''invoice-documents'' AND (select auth.uid())::text = (storage.foldername(name))[1])';
                END IF;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE NOTICE 'Could not manage policies on storage.objects for bucket % (skipping): %', b, SQLERRM;
        END;
    END LOOP;
END $$;

-- ==========================================
-- 49. ADMIN ALERTS POLICIES
-- ==========================================

ALTER TABLE public.admin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and managers can view alerts" ON public.admin_alerts;
CREATE POLICY "Admins and managers can view alerts" ON public.admin_alerts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Admins and managers can update alerts" ON public.admin_alerts;
CREATE POLICY "Admins and managers can update alerts" ON public.admin_alerts
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Admins and managers can delete alerts" ON public.admin_alerts;
CREATE POLICY "Admins and managers can delete alerts" ON public.admin_alerts
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM profiles JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() AND roles.name IN ('admin', 'manager')
        )
    );

DROP POLICY IF EXISTS "Service role can insert alerts" ON public.admin_alerts;
CREATE POLICY "Service role can insert alerts" ON public.admin_alerts
    FOR INSERT TO service_role WITH CHECK (true);

-- ==========================================
-- 50. GRANT STATEMENTS
-- ==========================================

GRANT EXECUTE ON FUNCTION get_products_paginated_v3(int, int, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_blogs_paginated(int, int, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_events_paginated(int, int, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_faqs_v2(text, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_site_content_v2(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_app_initial_payload_v4(text) TO anon, authenticated, service_role;

-- ==========================================
-- END OF BASELINE
-- ==========================================
-- ============================================================================
-- Fresh DB Baseline
-- Purpose: create the active runtime schema for a brand-new database using the
-- current application flow, without replaying the entire historical migration
-- chain.
-- Date: 2026-04-01
-- Notes:
-- - This baseline intentionally excludes known legacy tables such as
--   refresh_tokens, webhook_events, refund_audit_logs, blog_comments_backup,
--   carousels, and team_members.
-- - It keeps only the runtime objects currently referenced by the application.
-- - Apply this only to a fresh database.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'email_notification_type') THEN
        CREATE TYPE email_notification_type AS ENUM (
            'REGISTRATION',
            'ORDER_CONFIRMATION',
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
            'ACCOUNT_DELETED',
            'ACCOUNT_DELETION_SCHEDULED',
            'ACCOUNT_DELETION_OTP',
            'MANAGER_WELCOME',
            'CONTACT_NOTIFICATION',
            'CONTACT_AUTO_REPLY'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'variant_mode_type') THEN
        CREATE TYPE variant_mode_type AS ENUM ('UNIT', 'SIZE');
    END IF;
END $$;

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

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

INSERT INTO public.roles (name)
VALUES ('admin'), ('manager'), ('customer')
ON CONFLICT (name) DO NOTHING;

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

CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.profiles p
        JOIN public.roles r ON r.id = p.role_id
        WHERE p.id = auth.uid()
          AND r.name IN ('admin', 'manager')
    );
$$;

CREATE TABLE IF NOT EXISTS public.auth_accounts (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    password_set_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS public.app_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
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
CREATE POLICY "service_role_account_deletion_jobs" ON public.account_deletion_jobs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_account_deletion_audit" ON public.account_deletion_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_deletion_authorization_tokens" ON public.deletion_authorization_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

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
CREATE POLICY "service_role_idempotency_keys" ON public.idempotency_keys FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_request_locks" ON public.request_locks FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS idempotency_keys_updated_at ON public.idempotency_keys;
CREATE TRIGGER idempotency_keys_updated_at BEFORE UPDATE ON public.idempotency_keys FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();
DROP TRIGGER IF EXISTS request_locks_updated_at ON public.request_locks;
CREATE TRIGGER request_locks_updated_at BEFORE UPDATE ON public.request_locks FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

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
CREATE POLICY "Managers can view their own permissions" ON public.manager_permissions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can manage all permissions" ON public.manager_permissions FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS manager_permissions_updated_at ON public.manager_permissions;
CREATE TRIGGER manager_permissions_updated_at BEFORE UPDATE ON public.manager_permissions FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

CREATE TABLE IF NOT EXISTS public.store_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view store settings" ON public.store_settings FOR SELECT USING (key IN ('delivery_threshold', 'delivery_charge', 'delivery_gst', 'delivery_gst_mode', 'base_currency'));
CREATE POLICY "Service role can manage all settings" ON public.store_settings FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS store_settings_updated_at ON public.store_settings;
CREATE TRIGGER store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

INSERT INTO public.store_settings (key, value, description) VALUES
('delivery_threshold', '1500', 'Minimum order amount for free delivery'),
('delivery_charge', '50', 'Standard delivery charge for orders below threshold'),
('delivery_gst', '0', 'Standard GST rate for delivery charges'),
('delivery_gst_mode', '"inclusive"', 'How delivery GST should be applied'),
('base_currency', '"INR"', 'Default display currency')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'event', 'faq', 'gallery')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (name, type)
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read categories" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    tags_i18n JSONB DEFAULT '{}'::jsonb,
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
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(created_at DESC);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read products" ON public.products FOR SELECT USING (true);
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON public.product_variants(product_id);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read product_variants" ON public.product_variants FOR SELECT USING (true);
CREATE POLICY "Admins manage product_variants" ON public.product_variants FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

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
CREATE POLICY "Public read delivery_configs" ON public.delivery_configs FOR SELECT USING (true);
CREATE POLICY "Admins manage delivery_configs" ON public.delivery_configs FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

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
CREATE POLICY "Public read coupons" ON public.coupons FOR SELECT USING (true);
CREATE POLICY "Admins manage coupons" ON public.coupons FOR ALL USING (public.is_admin_or_manager()) WITH CHECK (public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.coupon_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    order_id UUID,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (coupon_id, order_id)
);

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
CREATE POLICY "Anonymous and Authenticated manage carts" ON public.carts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for cart_items" ON public.cart_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

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
CREATE POLICY "Users can view own addresses" ON public.addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own addresses" ON public.addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON public.addresses FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON public.addresses FOR DELETE USING (auth.uid() = user_id);

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
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    "updatedAt" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_manager());
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
CREATE POLICY "Public can view order history" ON public.order_status_history FOR SELECT USING (true);
CREATE POLICY "Users can view own order history" ON public.order_status_history FOR SELECT USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.user_id = auth.uid() OR public.is_admin_or_manager())));
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
CREATE POLICY "Public can view order reservations" ON public.order_reservations FOR SELECT USING (true);
CREATE POLICY "Service role manage order reservations" ON public.order_reservations FOR ALL TO service_role USING (true) WITH CHECK (true);


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
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin_or_manager());
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read events" ON public.events FOR SELECT USING (true);
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view published blogs" ON public.blogs FOR SELECT USING (published = true OR public.is_admin_or_manager());
CREATE POLICY "Service role manage blogs" ON public.blogs FOR ALL TO service_role USING (true) WITH CHECK (true);

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
CREATE POLICY "Public can view approved testimonials" ON public.testimonials FOR SELECT USING (approved = true OR auth.uid() = user_id OR public.is_admin_or_manager());
CREATE POLICY "Users can create testimonials" ON public.testimonials FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
CREATE POLICY "Users can update testimonials" ON public.testimonials FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
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
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Users manage own reviews" ON public.reviews FOR ALL USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());

CREATE TABLE IF NOT EXISTS public.gallery_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    name_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    is_hidden BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gallery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_id UUID REFERENCES public.gallery_folders(id) ON DELETE SET NULL,
    title TEXT,
    description TEXT,
    title_i18n JSONB DEFAULT '{}'::jsonb,
    description_i18n JSONB DEFAULT '{}'::jsonb,
    image_url TEXT NOT NULL,
    display_order INTEGER DEFAULT 0,
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
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
CREATE POLICY "Anyone can view active comments" ON public.comments FOR SELECT USING (status = 'active' OR public.is_admin_or_manager());
CREATE POLICY "Authenticated users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id OR public.is_admin_or_manager()) WITH CHECK (auth.uid() = user_id OR public.is_admin_or_manager());
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

CREATE TABLE IF NOT EXISTS public.contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    type email_notification_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE OR REPLACE FUNCTION public.generate_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    RETURN 'ODR-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::text, '-', ''), 1, 8));
END;
$$;

CREATE OR REPLACE FUNCTION public.log_email_notification(
    p_user_id UUID,
    p_type email_notification_type,
    p_title TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO public.email_notifications (user_id, type, title, content, metadata)
    VALUES (p_user_id, p_type, p_title, p_content, COALESCE(p_metadata, '{}'::jsonb))
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$;

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
    SET is_primary = false,
        updated_at = NOW()
    WHERE user_id = p_user_id
      AND id <> p_address_id;

    UPDATE public.addresses
    SET is_primary = true,
        updated_at = NOW()
    WHERE id = p_address_id
      AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_coupon_usage(p_coupon_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    UPDATE public.coupons
    SET usage_count = COALESCE(usage_count, 0) + 1,
        updated_at = NOW()
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
    SET registrations = COALESCE(registrations, 0) + 1,
        updated_at = NOW()
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
    SET registrations = GREATEST(COALESCE(registrations, 0) - 1, 0),
        updated_at = NOW()
    WHERE id = p_event_id;
END;
$$;

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
    SET stock_quantity = GREATEST(stock_quantity - COALESCE(p_quantity, 0), 0),
        updated_at = NOW()
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
        SET stock_quantity = COALESCE(stock_quantity, 0) + COALESCE(p_quantity, 0),
            updated_at = NOW()
        WHERE id = p_variant_id;
    ELSIF p_product_id IS NOT NULL THEN
        UPDATE public.products
        SET inventory = COALESCE(inventory, 0) + COALESCE(p_quantity, 0),
            updated_at = NOW()
        WHERE id = p_product_id;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.batch_decrement_inventory_atomic(
    p_items JSONB
) RETURNS JSONB
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
            SET stock_quantity = GREATEST(stock_quantity - COALESCE((v_item->>'quantity')::INTEGER, 0), 0),
                updated_at = NOW()
            WHERE id = (v_item->>'variant_id')::UUID;
        ELSIF (v_item->>'product_id') IS NOT NULL THEN
            UPDATE public.products
            SET inventory = GREATEST(inventory - COALESCE((v_item->>'quantity')::INTEGER, 0), 0),
                updated_at = NOW()
            WHERE id = (v_item->>'product_id')::UUID;
        END IF;
    END LOOP;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.create_product_with_variants(
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
        title_i18n, description_i18n, tags_i18n
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
        COALESCE(p_product_data->'tags_i18n', '{}'::jsonb)
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
        UPDATE public.payments
        SET order_id = v_order_id,
            updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    IF p_coupon_code IS NOT NULL THEN
        UPDATE public.coupons
        SET usage_count = COALESCE(usage_count, 0) + 1,
            updated_at = NOW()
        WHERE code = p_coupon_code;
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

CREATE OR REPLACE FUNCTION public.create_subscription_transactional(
    p_user_id UUID,
    p_donation_ref TEXT,
    p_razorpay_subscription_id TEXT,
    p_razorpay_plan_id TEXT,
    p_amount NUMERIC,
    p_donor_name TEXT,
    p_donor_email TEXT,
    p_donor_phone TEXT,
    p_is_anonymous BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_donation_id UUID;
    v_subscription_id UUID;
BEGIN
    INSERT INTO public.donations (
        user_id, donation_reference_id, amount, donor_name, donor_email,
        donor_phone, is_anonymous, donation_type, payment_status, status
    ) VALUES (
        p_user_id, p_donation_ref, COALESCE(p_amount, 0), p_donor_name, p_donor_email,
        p_donor_phone, COALESCE(p_is_anonymous, false), 'MONTHLY', 'created', 'pending'
    )
    RETURNING id INTO v_donation_id;

    INSERT INTO public.donation_subscriptions (
        user_id, donation_id, donation_reference_id, razorpay_subscription_id,
        razorpay_plan_id, amount, status
    ) VALUES (
        p_user_id, v_donation_id, p_donation_ref, p_razorpay_subscription_id,
        p_razorpay_plan_id, COALESCE(p_amount, 0), 'created'
    )
    RETURNING id INTO v_subscription_id;

    RETURN jsonb_build_object(
        'donation_id', v_donation_id,
        'subscription_id', v_subscription_id,
        'donation_reference_id', p_donation_ref
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.update_subscription_status_transactional(
    p_razorpay_subscription_id TEXT,
    p_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_row public.donation_subscriptions;
BEGIN
    UPDATE public.donation_subscriptions
    SET status = p_status,
        updated_at = NOW()
    WHERE razorpay_subscription_id = p_razorpay_subscription_id
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_donation_transactional(
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_payment_status TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_donation public.donations;
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
    p_registration_id UUID,
    p_razorpay_payment_id TEXT,
    p_razorpay_signature TEXT,
    p_invoice_url TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_registration public.event_registrations;
BEGIN
    UPDATE public.event_registrations
    SET razorpay_payment_id = p_razorpay_payment_id,
        razorpay_signature = p_razorpay_signature,
        invoice_url = COALESCE(p_invoice_url, invoice_url),
        payment_status = 'captured',
        status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_registration_id
    RETURNING * INTO v_registration;

    RETURN jsonb_build_object('registration', to_jsonb(v_registration));
END;
$$;

CREATE OR REPLACE FUNCTION public.check_comment_rate_limit(
    p_user_id UUID,
    p_blog_id UUID,
    p_max_comments INTEGER DEFAULT 5
) RETURNS TABLE (
    is_allowed BOOLEAN,
    comments_remaining INTEGER,
    window_resets_at TIMESTAMPTZ,
    current_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT *
    INTO v_rec
    FROM public.comment_rate_limits
    WHERE user_id = p_user_id
      AND blog_id = p_blog_id
      AND window_end > NOW()
    ORDER BY window_start DESC
    LIMIT 1;

    IF NOT FOUND THEN
        RETURN QUERY SELECT true, p_max_comments, NULL::TIMESTAMPTZ, 0;
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        (v_rec.comment_count < p_max_comments),
        GREATEST(p_max_comments - v_rec.comment_count, 0),
        v_rec.window_end,
        v_rec.comment_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_threaded_comments(
    p_blog_id UUID
) RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = public
AS $$
    SELECT COALESCE(
        jsonb_agg(to_jsonb(c) ORDER BY c.created_at ASC),
        '[]'::jsonb
    )
    FROM public.comments c
    WHERE c.blog_id = p_blog_id
      AND c.status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.get_table_columns_info(t_name TEXT)
RETURNS TABLE (
    column_name TEXT,
    data_type TEXT,
    is_nullable TEXT
)
LANGUAGE sql
SET search_path = public
AS $$
    SELECT
        c.column_name::TEXT,
        c.data_type::TEXT,
        c.is_nullable::TEXT
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = t_name
    ORDER BY c.ordinal_position;
$$;

CREATE OR REPLACE FUNCTION public.get_public_homepage_content(
    p_now TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
    RETURN jsonb_build_object(
        'products', COALESCE((SELECT jsonb_agg(to_jsonb(p)) FROM (
            SELECT * FROM public.products WHERE is_active = true ORDER BY created_at DESC LIMIT 8
        ) p), '[]'::jsonb),
        'events', COALESCE((SELECT jsonb_agg(to_jsonb(e)) FROM (
            SELECT * FROM public.events WHERE status IN ('upcoming', 'ongoing') ORDER BY start_date ASC LIMIT 6
        ) e), '[]'::jsonb),
        'blogs', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM (
            SELECT * FROM public.blogs WHERE published = true ORDER BY date DESC LIMIT 6
        ) b), '[]'::jsonb),
        'testimonials', COALESCE((SELECT jsonb_agg(to_jsonb(t)) FROM (
            SELECT * FROM public.testimonials WHERE approved = true ORDER BY created_at DESC LIMIT 8
        ) t), '[]'::jsonb),
        'galleryItems', COALESCE((SELECT jsonb_agg(to_jsonb(g)) FROM (
            SELECT * FROM public.gallery_items ORDER BY created_at DESC LIMIT 12
        ) g), '[]'::jsonb),
        'carouselSlides', COALESCE((SELECT jsonb_agg(to_jsonb(c)) FROM (
            SELECT * FROM public.carousel_slides WHERE is_active = true ORDER BY COALESCE(order_index, display_order, 0) ASC
        ) c), '[]'::jsonb)
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats_v3(
    p_from TIMESTAMPTZ DEFAULT NULL,
    p_to TIMESTAMPTZ DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
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
            SELECT COALESCE(SUM(total_amount), 0)
            FROM public.orders
            WHERE COALESCE(payment_status, status) IN ('paid', 'captured', 'completed', 'delivered')
              AND created_at BETWEEN v_from AND v_to
        ),
        'netRevenue', (
            SELECT
                COALESCE((
                    SELECT SUM(o.total_amount)
                    FROM public.orders o
                    WHERE COALESCE(o.payment_status, o.status) IN ('paid', 'captured', 'completed', 'delivered')
                      AND o.created_at BETWEEN v_from AND v_to
                ), 0)
                -
                COALESCE((
                    SELECT SUM(r.amount)
                    FROM public.refunds r
                    WHERE COALESCE(r.status, '') IN ('processed', 'completed', 'refunded')
                      AND r.created_at BETWEEN v_from AND v_to
                ), 0)
        ),
        'events', (SELECT COUNT(*) FROM public.events),
        'returns', (SELECT COUNT(*) FROM public.returns)
    );
END;
$$;

ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

INSERT INTO storage.buckets (id, name, public) VALUES
('images', 'images', true),
('events', 'events', true),
('blogs', 'blogs', true),
('gallery', 'gallery', true),
('team', 'team', true),
('testimonial-user', 'testimonial-user', true),
('return_images', 'return_images', true),
('policy-documents', 'policy-documents', true),
('profiles', 'profiles', false),
('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read images" ON storage.objects;
CREATE POLICY "Public read images" ON storage.objects FOR SELECT USING (bucket_id IN ('images', 'events', 'blogs', 'gallery', 'team', 'testimonial-user', 'return_images', 'policy-documents'));

DROP POLICY IF EXISTS "Authenticated insert public media" ON storage.objects;
CREATE POLICY "Authenticated insert public media" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id IN ('images', 'events', 'blogs', 'gallery', 'team', 'testimonial-user', 'return_images', 'policy-documents'));

DROP POLICY IF EXISTS "Authenticated update public media" ON storage.objects;
CREATE POLICY "Authenticated update public media" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id IN ('images', 'events', 'blogs', 'gallery', 'team', 'testimonial-user', 'return_images', 'policy-documents'));

DROP POLICY IF EXISTS "Authenticated delete public media" ON storage.objects;
CREATE POLICY "Authenticated delete public media" ON storage.objects FOR DELETE TO authenticated USING (bucket_id IN ('images', 'events', 'blogs', 'gallery', 'team', 'testimonial-user', 'return_images', 'policy-documents'));

DROP POLICY IF EXISTS "Owners read profiles bucket" ON storage.objects;
CREATE POLICY "Owners read profiles bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'profiles' AND (owner = auth.uid() OR public.is_admin_or_manager()));

DROP POLICY IF EXISTS "Owners write profiles bucket" ON storage.objects;
CREATE POLICY "Owners write profiles bucket" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profiles' AND owner = auth.uid());

DROP POLICY IF EXISTS "Owners update profiles bucket" ON storage.objects;
CREATE POLICY "Owners update profiles bucket" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profiles' AND (owner = auth.uid() OR public.is_admin_or_manager()));

DROP POLICY IF EXISTS "Owners read invoices bucket" ON storage.objects;
CREATE POLICY "Owners read invoices bucket" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'invoices' AND public.is_admin_or_manager());

DROP POLICY IF EXISTS "Admins manage invoices bucket" ON storage.objects;
CREATE POLICY "Admins manage invoices bucket" ON storage.objects FOR ALL TO authenticated USING (bucket_id = 'invoices' AND public.is_admin_or_manager()) WITH CHECK (bucket_id = 'invoices' AND public.is_admin_or_manager());


-- ====================================
-- APPENDED MISSING MIGRATIONS
-- ====================================

-- FROM 20260326_create_auth_refresh_metrics.sql
BEGIN;

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
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_created_at
ON public.auth_refresh_metrics(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_event_type
ON public.auth_refresh_metrics(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_reason
ON public.auth_refresh_metrics(reason, created_at DESC)
WHERE reason IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_auth_refresh_metrics_correlation
ON public.auth_refresh_metrics(correlation_id)
WHERE correlation_id IS NOT NULL;

ALTER TABLE public.auth_refresh_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_auth_refresh_metrics" ON public.auth_refresh_metrics;
CREATE POLICY "service_role_all_auth_refresh_metrics"
ON public.auth_refresh_metrics FOR ALL TO service_role
USING (true) WITH CHECK (true);

COMMIT;


-- FROM create_blog_comments_table.sql
-- Create blog_comments table
CREATE TABLE IF NOT EXISTS public.blog_comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.blog_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_flagged BOOLEAN DEFAULT false,
    flag_reason TEXT,
    flagged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.blog_comments ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Comments are viewable by everyone" 
ON public.blog_comments FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can create comments" 
ON public.blog_comments FOR INSERT 
WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their own comments" 
ON public.blog_comments FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" 
ON public.blog_comments FOR DELETE 
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_blog_comments_blog_id ON public.blog_comments(blog_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_user_id ON public.blog_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_blog_comments_parent_id ON public.blog_comments(parent_id);


-- FROM 20260114_security_function_fixes.sql
-- ==========================================
-- Security & Function Fixes Migration
-- Fixes security_definer_view, function_search_path_mutable warnings
-- Created: 2026-01-14
-- ==========================================

BEGIN;

-- ==========================================
-- FIX: security_definer_view
-- Drop and recreate public_testimonials view without SECURITY DEFINER
-- ==========================================

DROP VIEW IF EXISTS public.public_testimonials;

CREATE VIEW public.public_testimonials 
WITH (security_invoker = true) AS
SELECT id, name, role, content, rating, image, created_at
FROM testimonials
WHERE approved = true
ORDER BY created_at DESC;

-- ==========================================
-- FIX: function_search_path_mutable
-- Recreate functions with SET search_path = public
-- ==========================================

-- update_newsletter_updated_at
CREATE OR REPLACE FUNCTION public.update_newsletter_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_comments_updated_at
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_manager_permissions_updated_at
CREATE OR REPLACE FUNCTION public.update_manager_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;



-- update_parent_reply_count
CREATE OR REPLACE FUNCTION public.update_parent_reply_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.parent_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = reply_count + 1
        WHERE id = NEW.parent_id;
    ELSIF TG_OP = 'DELETE' AND OLD.parent_id IS NOT NULL THEN
        UPDATE public.comments
        SET reply_count = GREATEST(0, reply_count - 1)
        WHERE id = OLD.parent_id;
    ELSIF TG_OP = 'UPDATE' AND OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        IF OLD.parent_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = GREATEST(0, reply_count - 1)
            WHERE id = OLD.parent_id;
        END IF;
        IF NEW.parent_id IS NOT NULL THEN
            UPDATE public.comments
            SET reply_count = reply_count + 1
            WHERE id = NEW.parent_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;



-- set_order_number
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := public.generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_testimonials_updated_at
CREATE OR REPLACE FUNCTION public.update_testimonials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_addresses_updated_at
CREATE OR REPLACE FUNCTION public.update_addresses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- ensure_one_primary_address
CREATE OR REPLACE FUNCTION public.ensure_one_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        UPDATE public.addresses SET is_primary = false 
        WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.addresses WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)) THEN
        NEW.is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_gallery_folders_updated_at
CREATE OR REPLACE FUNCTION public.update_gallery_folders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_gallery_items_updated_at
CREATE OR REPLACE FUNCTION public.update_gallery_items_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_gallery_videos_updated_at
CREATE OR REPLACE FUNCTION public.update_gallery_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_faqs_updated_at
CREATE OR REPLACE FUNCTION public.update_faqs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_social_media_updated_at
CREATE OR REPLACE FUNCTION public.update_social_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_contact_updated_at
CREATE OR REPLACE FUNCTION public.update_contact_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- update_cart_timestamp
CREATE OR REPLACE FUNCTION public.update_cart_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.carts SET updated_at = NOW() WHERE id = NEW.cart_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- check_primary_address
CREATE OR REPLACE FUNCTION public.check_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_primary = true THEN
        RAISE EXCEPTION 'Cannot delete the primary address. Set another address as primary first.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- check_address_type_limit
CREATE OR REPLACE FUNCTION public.check_address_type_limit()
RETURNS TRIGGER AS $$
DECLARE
    type_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO type_count 
    FROM public.addresses 
    WHERE user_id = NEW.user_id AND type = NEW.type AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
    
    IF type_count >= 3 THEN
        RAISE EXCEPTION 'Maximum of 3 addresses per type allowed';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- check_coupon_target_id
CREATE OR REPLACE FUNCTION public.check_coupon_target_id()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.type IN ('product', 'category') AND (NEW.target_id IS NULL OR NEW.target_id = '') THEN
        RAISE EXCEPTION 'target_id is required for product and category type coupons';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Drop and recreate generate functions (return type may differ)
-- Using CASCADE as triggers depend on these functions
DROP FUNCTION IF EXISTS public.generate_product_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_category_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_event_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_blog_code() CASCADE;
DROP FUNCTION IF EXISTS public.generate_order_number() CASCADE;
DROP FUNCTION IF EXISTS public.get_total_donations() CASCADE;
DROP FUNCTION IF EXISTS public.get_product_category_stats() CASCADE;

-- generate_product_code
CREATE FUNCTION public.generate_product_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := 'PRD-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN new_code;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- generate_category_code
CREATE FUNCTION public.generate_category_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := 'CAT-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN new_code;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- generate_event_code
CREATE FUNCTION public.generate_event_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := 'EVT-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN new_code;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- generate_blog_code
CREATE FUNCTION public.generate_blog_code()
RETURNS TEXT AS $$
DECLARE
    new_code TEXT;
BEGIN
    new_code := 'BLG-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 8));
    RETURN new_code;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- generate_order_number
CREATE FUNCTION public.generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
BEGIN
    new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 6));
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- get_total_donations
CREATE FUNCTION public.get_total_donations() 
RETURNS DECIMAL AS $$
BEGIN
  RETURN (SELECT COALESCE(SUM(amount), 0) FROM public.donations WHERE payment_status = 'success');
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- get_product_category_stats
CREATE FUNCTION public.get_product_category_stats() 
RETURNS TABLE (category TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY SELECT COALESCE(p.category, 'Uncategorized') as category, COUNT(*) as count 
  FROM public.products p GROUP BY p.category ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Recreate triggers that were dropped with CASCADE
-- Note: Only recreate if they don't already exist (some may have been dropped)
DO $$
BEGIN
    -- Product code trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_product_code') THEN
        CREATE TRIGGER trigger_generate_product_code
            BEFORE INSERT ON public.products
            FOR EACH ROW
            WHEN (NEW.code IS NULL)
            EXECUTE FUNCTION public.generate_product_code();
    END IF;
    
    -- Category code trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_category_code') THEN
        CREATE TRIGGER trigger_generate_category_code
            BEFORE INSERT ON public.categories
            FOR EACH ROW
            WHEN (NEW.code IS NULL)
            EXECUTE FUNCTION public.generate_category_code();
    END IF;
    
    -- Event code trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_event_code') THEN
        CREATE TRIGGER trigger_generate_event_code
            BEFORE INSERT ON public.events
            FOR EACH ROW
            WHEN (NEW.code IS NULL)
            EXECUTE FUNCTION public.generate_event_code();
    END IF;
    
    -- Blog code trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_generate_blog_code') THEN
        CREATE TRIGGER trigger_generate_blog_code
            BEFORE INSERT ON public.blogs
            FOR EACH ROW
            WHEN (NEW.code IS NULL)
            EXECUTE FUNCTION public.generate_blog_code();
    END IF;
    
    -- Order number trigger
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_set_order_number') THEN
        CREATE TRIGGER trigger_set_order_number
            BEFORE INSERT ON public.orders
            FOR EACH ROW
            EXECUTE FUNCTION public.set_order_number();
    END IF;
END $$;

-- Note: The following complex functions need careful review before modifying
-- They have SECURITY DEFINER which may be intentional for bypassing RLS

-- get_or_create_cart (keeping SECURITY DEFINER but adding search_path)
CREATE OR REPLACE FUNCTION public.get_or_create_cart(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_cart_id UUID;
BEGIN
    INSERT INTO public.carts (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT id INTO v_cart_id FROM public.carts WHERE user_id = p_user_id;
    RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- add_to_cart_atomic (keeping SECURITY DEFINER but adding search_path)
CREATE OR REPLACE FUNCTION public.add_to_cart_atomic(p_user_id UUID, p_product_id UUID, p_quantity INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    v_cart_id := public.get_or_create_cart(p_user_id);
    INSERT INTO public.cart_items (cart_id, product_id, quantity)
    VALUES (v_cart_id, p_product_id, p_quantity)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;

    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(json_agg(json_build_object('id', ci.id, 'product_id', ci.product_id, 'quantity', ci.quantity, 'added_at', ci.added_at, 'products', p.*)) FILTER (WHERE ci.id IS NOT NULL), '[]')
    ) INTO v_result FROM public.carts c LEFT JOIN public.cart_items ci ON c.id = ci.cart_id LEFT JOIN public.products p ON ci.product_id = p.id WHERE c.id = v_cart_id GROUP BY c.id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- update_cart_item_atomic (keeping SECURITY DEFINER but adding search_path)
CREATE OR REPLACE FUNCTION public.update_cart_item_atomic(p_user_id UUID, p_product_id UUID, p_quantity INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    v_cart_id := public.get_or_create_cart(p_user_id);
    IF p_quantity <= 0 THEN
        DELETE FROM public.cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id;
    ELSE
        INSERT INTO public.cart_items (cart_id, product_id, quantity) VALUES (v_cart_id, p_product_id, p_quantity)
        ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = p_quantity;
    END IF;

    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(json_agg(json_build_object('id', ci.id, 'product_id', ci.product_id, 'quantity', ci.quantity, 'added_at', ci.added_at, 'products', p.*)) FILTER (WHERE ci.id IS NOT NULL), '[]')
    ) INTO v_result FROM public.carts c LEFT JOIN public.cart_items ci ON c.id = ci.cart_id LEFT JOIN public.products p ON ci.product_id = p.id WHERE c.id = v_cart_id GROUP BY c.id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- set_primary_address (keeping SECURITY DEFINER but adding search_path)  
CREATE OR REPLACE FUNCTION public.set_primary_address(p_user_id UUID, p_address_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.addresses SET is_primary = false WHERE user_id = p_user_id;
    UPDATE public.addresses SET is_primary = true WHERE id = p_address_id AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- decrement_inventory_atomic
CREATE OR REPLACE FUNCTION public.decrement_inventory_atomic(p_product_id UUID, p_quantity INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    current_inv INTEGER;
BEGIN
    SELECT inventory INTO current_inv FROM public.products WHERE id = p_product_id FOR UPDATE;
    IF current_inv IS NULL THEN
        RETURN FALSE;
    END IF;
    IF current_inv < p_quantity THEN
        RETURN FALSE;
    END IF;
    UPDATE public.products SET inventory = inventory - p_quantity WHERE id = p_product_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- increment_inventory_atomic
CREATE OR REPLACE FUNCTION public.increment_inventory_atomic(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE public.products SET inventory = inventory + p_quantity WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- batch_decrement_inventory_atomic
CREATE OR REPLACE FUNCTION public.batch_decrement_inventory_atomic(p_items JSONB)
RETURNS BOOLEAN AS $$
DECLARE
    item RECORD;
    current_inv INTEGER;
BEGIN
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER)
    LOOP
        SELECT inventory INTO current_inv FROM public.products WHERE id = item.product_id FOR UPDATE;
        IF current_inv IS NULL OR current_inv < item.quantity THEN
            RETURN FALSE;
        END IF;
    END LOOP;
    
    FOR item IN SELECT * FROM jsonb_to_recordset(p_items) AS x(product_id UUID, quantity INTEGER)
    LOOP
        UPDATE public.products SET inventory = inventory - item.quantity WHERE id = item.product_id;
    END LOOP;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

COMMIT;

-- ==========================================
-- NOTE: rls_policy_always_true warnings
-- ==========================================
-- Many "USING (true)" policies exist intentionally for:
-- 1. Service role access (bypasses RLS anyway)
-- 2. Public insert for contact forms
-- 3. Cart operations (handled via SECURITY DEFINER functions)
-- 4. Products/categories (public read/write for admin operations)
--
-- These should be reviewed case-by-case based on security requirements.
-- Some may need to be restricted to service_role or admin only.

-- ==========================================
-- NOTE: auth_leaked_password_protection
-- ==========================================
-- This must be enabled in Supabase Dashboard:
-- Settings > Authentication > Password Security > Enable Leaked Password Protection


-- FROM fix_missing_profiles.sql
-- 1. Create function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    default_role_id INTEGER;
    meta_name TEXT;
    user_first_name TEXT;
    user_last_name TEXT;
BEGIN
    -- Get customer role id (fallback to 3 if not found, but should exist)
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer';
    
    -- Extract name from metadata
    meta_name := NEW.raw_user_meta_data->>'name';
    
    -- Determine First/Last Name
    IF meta_name IS NOT NULL AND length(meta_name) > 0 THEN
        user_first_name := split_part(meta_name, ' ', 1);
        IF position(' ' in meta_name) > 0 THEN
             user_last_name := substring(meta_name from position(' ' in meta_name) + 1);
        ELSE
             user_last_name := NULL;
        END IF;
    ELSE
        -- Fallback: use email prefix as First Name
        user_first_name := split_part(NEW.email, '@', 1);
        user_last_name := NULL;
    END IF;

    -- Insert into public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        name,
        phone,
        role_id,
        created_at,
        updated_at,
        email_verified,
        phone_verified,
        is_deleted,
        is_blocked,
        first_name,
        last_name
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(meta_name, NEW.email),
        NEW.raw_user_meta_data->>'phone',
        default_role_id,
        NOW(),
        NOW(),
        (NEW.email_confirmed_at IS NOT NULL),
        (NEW.phone_confirmed_at IS NOT NULL),
        false,
        false,
        user_first_name,
        user_last_name
    )
    ON CONFLICT (id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill missing profiles for existing users
-- Includes logic to generate required first_name from email if name is missing
INSERT INTO public.profiles (
    id, 
    email, 
    name, 
    role_id, 
    created_at, 
    updated_at, 
    is_deleted, 
    is_blocked,
    first_name,
    last_name
)
SELECT 
    au.id,
    au.email,
    -- name (fallback to email)
    COALESCE(au.raw_user_meta_data->>'name', au.email),
    (SELECT id FROM public.roles WHERE name = 'customer'),
    au.created_at,
    NOW(),
    false,
    false,
    -- first_name (Required: fallback to email prefix)
    COALESCE(
        NULLIF(split_part(au.raw_user_meta_data->>'name', ' ', 1), ''),
        split_part(au.email, '@', 1)
    ),
    -- last_name (Optional)
    CASE 
        WHEN position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) > 0 
        THEN substring(COALESCE(au.raw_user_meta_data->>'name', '') from position(' ' in COALESCE(au.raw_user_meta_data->>'name', '')) + 1)
        ELSE NULL 
    END
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL;


-- FROM 20260121_comprehensive_rls_policies.sql
-- =====================================================
-- DEPRECATED RLS MIGRATION SAFETY SHIM
-- Created: 2026-01-21
-- Purpose: Preserve helper functions without mass-dropping all public policies.
--
-- Why this file is intentionally minimal:
-- The original version attempted to DROP every public-schema policy and then
-- recreate them in one pass. That is unsafe for production rollouts because:
-- 1. A syntax/runtime failure mid-migration can leave RLS partially removed.
-- 2. It overrode many table-specific policies defined in earlier migrations.
-- 3. It contained invalid policy syntax for INSERT rules.
--
-- Fresh deployments should rely on the table-specific migrations plus the
-- targeted repair migration in 20260121_comprehensive_rls_fix.sql.
-- =====================================================

-- Helper function to check if current user is admin or manager.
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

-- Helper function to check if the current user owns a specific order.
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

COMMENT ON FUNCTION public.is_admin_or_manager() IS
'Security-definer helper used by targeted RLS policies to detect admin or manager access.';

COMMENT ON FUNCTION public.user_owns_order(UUID) IS
'Security-definer helper used by targeted RLS policies to detect order ownership.';

DO $$
BEGIN
    RAISE NOTICE '20260121_comprehensive_rls_policies.sql is intentionally a no-op beyond helper functions. Use targeted RLS migrations for policy changes.';
END;
$$;



-- DROP ANY DEPRECATED VIEW
DROP VIEW IF EXISTS public.public_testimonials;

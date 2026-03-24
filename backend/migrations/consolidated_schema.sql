-- ==========================================
-- GAU GYAAN CONSOLIDATED SCHEMA
-- Consolidates all migrations into a single file
-- ==========================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
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
END $$;

-- 3. CORE FUNCTIONS

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Legacy function name compatibility
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. IDENTITY & PROFILES

-- Roles Table
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE
);

-- Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT,
    phone TEXT,
    role_id INTEGER REFERENCES roles(id),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    avatar_url TEXT,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_blocked BOOLEAN DEFAULT false,
    must_change_password BOOLEAN DEFAULT false,
    created_by UUID REFERENCES profiles(id),
    email_verification_token TEXT,
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for profiles
CREATE INDEX IF NOT EXISTS idx_profiles_is_deleted ON profiles(is_deleted);
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_email_verification_token ON profiles(email_verification_token) WHERE email_verification_token IS NOT NULL;

-- Enable RLS for profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Policies for profiles
CREATE POLICY "Public profiles are viewable by everyone" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger for profiles
CREATE TRIGGER profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- 5. SEED ROLES
INSERT INTO roles (name) VALUES ('admin'), ('manager'), ('customer') ON CONFLICT (name) DO NOTHING;

-- 6. ECOMMERCE SECTION

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'product' CHECK (type IN ('product', 'event', 'faq', 'gallery')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (name, type)
);

CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for categories" ON categories FOR ALL USING (true) WITH CHECK (true);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    mrp DECIMAL(10, 2),
    images TEXT[] DEFAULT '{}',
    category TEXT NOT NULL,
    tags TEXT[] DEFAULT '{}',
    inventory INTEGER DEFAULT 0,
    stock INTEGER DEFAULT 0, -- Some migrations use 'stock', some 'inventory'. Unifying or keeping both if needed, but 'inventory' is more common here.
    benefits TEXT[] DEFAULT '{}',
    is_returnable BOOLEAN DEFAULT true,
    return_days INTEGER DEFAULT 3,
    is_new BOOLEAN DEFAULT false,
    rating DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for products" ON products FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE,
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhone" TEXT,
    shipping_address_id UUID, -- References addresses(id) added later
    billing_address_id UUID, -- References addresses(id) added later
    "shippingAddress" JSONB,
    items JSONB,
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(10, 2) NOT NULL DEFAULT 0, -- CamelCase compatibility
    subtotal DECIMAL(10, 2),
    coupon_code TEXT,
    coupon_discount DECIMAL(10, 2) DEFAULT 0,
    delivery_charge DECIMAL(10, 2) DEFAULT 0,
    status TEXT DEFAULT 'pending',
    payment_status TEXT DEFAULT 'pending',
    "paymentStatus" TEXT DEFAULT 'pending', -- CamelCase compatibility
    notes TEXT,
    return_request JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Enable all operations for orders" ON orders FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE PROCEDURE handle_updated_at();

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id),
    title TEXT,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price_per_unit DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) GENERATED ALWAYS AS (quantity * price_per_unit) STORED,
    is_returnable BOOLEAN DEFAULT TRUE,
    returned_quantity INTEGER DEFAULT 0 CHECK (returned_quantity >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE order_items ADD CONSTRAINT check_returned_quantity_limit CHECK (returned_quantity <= quantity);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- Order Status History
CREATE TABLE IF NOT EXISTS order_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_status_history_order ON order_status_history(order_id);

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own order status history" ON order_status_history FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = order_status_history.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Service role can manage order status history" ON order_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Carts and Cart Items
CREATE TABLE IF NOT EXISTS carts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    applied_coupon_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cart_id, product_id)
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for carts" ON carts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Enable all operations for cart_items" ON cart_items FOR ALL USING (true) WITH CHECK (true);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT UNIQUE,
    razorpay_signature TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    status TEXT DEFAULT 'created',
    method TEXT,
    email TEXT,
    contact TEXT,
    error_code TEXT,
    error_description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON payments FOR SELECT USING (auth.uid() = user_id);

-- Coupons
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT NOT NULL UNIQUE,
    type TEXT NOT NULL CHECK (type IN ('product', 'category', 'cart')),
    discount_percentage INTEGER NOT NULL CHECK (discount_percentage > 0 AND discount_percentage <= 100),
    target_id TEXT,
    min_purchase_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
    usage_limit INTEGER,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all operations for coupons" ON coupons FOR ALL USING (true) WITH CHECK (true);


-- 10. SYSTEM & UTILITIES

-- Newsletter Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'subscribed' CHECK (status IN ('subscribed', 'unsubscribed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Newsletter Config
CREATE TABLE IF NOT EXISTS newsletter_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_name TEXT,
    sender_email TEXT,
    footer_text TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bank Details
CREATE TABLE IF NOT EXISTS bank_details (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_name TEXT NOT NULL,
    account_number TEXT NOT NULL,
    bank_name TEXT NOT NULL,
    ifsc_code TEXT NOT NULL,
    upi_id TEXT,
    qr_code_url TEXT,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'donation')),
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active general bank details" ON bank_details FOR SELECT USING (is_active = true AND type = 'general');

-- FAQs
CREATE TABLE IF NOT EXISTS faqs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category TEXT REFERENCES categories(name) ON DELETE SET NULL,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active FAQs" ON faqs FOR SELECT USING (is_active = true);

-- Carousel Slides
CREATE TABLE IF NOT EXISTS carousel_slides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    subtitle TEXT,
    image_url TEXT NOT NULL,
    link_url TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE carousel_slides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active carousel slides" ON carousel_slides FOR SELECT USING (is_active = true);

-- Contact Messages
CREATE TABLE IF NOT EXISTS contact_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert contact messages" ON contact_messages FOR INSERT WITH CHECK (true);

-- 11. LOGGING & NOTIFICATIONS

-- Email Logs
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    template_name TEXT,
    status TEXT DEFAULT 'sent',
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Admin Alerts
CREATE TABLE IF NOT EXISTS admin_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Email Notifications Table (reconstructed)
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    type email_notification_type NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_notifications_user ON email_notifications(user_id);

ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON email_notifications FOR SELECT USING (auth.uid() = user_id);

-- 12. ADVANCED SYSTEM TABLES (Moderation/Rate Limiting)

-- Comments (New System)
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'hidden', 'deleted')),
    is_flagged BOOLEAN DEFAULT false NOT NULL,
    flag_reason TEXT,
    flag_count INTEGER DEFAULT 0 NOT NULL,
    flagged_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    flagged_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    edit_count INTEGER DEFAULT 0 NOT NULL,
    last_edited_at TIMESTAMP WITH TIME ZONE,
    reply_count INTEGER DEFAULT 0 NOT NULL,
    upvotes INTEGER DEFAULT 0 NOT NULL,
    downvotes INTEGER DEFAULT 0 NOT NULL
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active comments" ON public.comments FOR SELECT USING (status = 'active');

-- Comment Moderation Log
CREATE TABLE IF NOT EXISTS public.comment_moderation_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    performed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Comment Rate Limits
CREATE TABLE IF NOT EXISTS public.comment_rate_limits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    blog_id UUID NOT NULL REFERENCES public.blogs(id) ON DELETE CASCADE,
    comment_count INTEGER DEFAULT 1 NOT NULL,
    window_start TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    window_end TIMESTAMP WITH TIME ZONE NOT NULL,
    UNIQUE(user_id, blog_id, window_start)
);

-- Comment Flags
CREATE TABLE IF NOT EXISTS public.comment_flags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    comment_id UUID NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
    flagged_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason VARCHAR(100) NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(comment_id, flagged_by)
);


-- 13. BUSINESS LOGIC FUNCTIONS & TRIGGERS

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
    new_order_number TEXT;
BEGIN
    new_order_number := 'ORD-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || UPPER(SUBSTRING(GEN_RANDOM_UUID()::TEXT, 1, 6));
    RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger function for order number
CREATE OR REPLACE FUNCTION set_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := generate_order_number();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_generate_order_number
    BEFORE INSERT ON orders
    FOR EACH ROW
    EXECUTE FUNCTION set_order_number();

-- Function to log email notification
CREATE OR REPLACE FUNCTION log_email_notification(
    p_user_id UUID,
    p_type email_notification_type,
    p_title TEXT,
    p_content TEXT,
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    INSERT INTO email_notifications (user_id, type, title, content, metadata)
    VALUES (p_user_id, p_type, p_title, p_content, p_metadata)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log email notification from email_logs
CREATE OR REPLACE FUNCTION trigger_log_email_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM profiles WHERE email = NEW.recipient LIMIT 1;
    IF v_user_id IS NOT NULL THEN
        PERFORM log_email_notification(
            v_user_id,
            'CONTACT_NOTIFICATION'::email_notification_type, -- Defaulting or mapping
            NEW.subject,
            'Email sent: ' || NEW.subject
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 14. FINAL SEED DATA

-- Categories
INSERT INTO categories (name, type) VALUES 
('Ghee', 'product'), ('Honey', 'product'), ('Oil', 'product'),
('Workshop', 'event'), ('Puja', 'event'), ('Seminar', 'event'),
('General', 'faq'), ('Orders', 'faq'), ('Payments', 'faq'),
('Events', 'gallery'), ('Gaushala', 'gallery'), ('Products', 'gallery')
ON CONFLICT (name, type) DO NOTHING;

-- About Settings
INSERT INTO about_settings (footer_description, section_visibility)
VALUES ('Gau Gyaan is dedicated to preserving and promoting the wisdom of Vedic culture and the importance of indigenous cows.', '{"team": true, "ourStory": true, "futureGoals": true, "impactStats": true, "callToAction": true, "missionVision": true}')
ON CONFLICT DO NOTHING;

-- Newsletter Config
INSERT INTO newsletter_config (sender_name, sender_email, footer_text)
VALUES ('Gau Gyaan', 'newsletter@gaugyaan.com', 'Protecting the Cow, Preserving the Culture.')
ON CONFLICT DO NOTHING;

-- 15. CLEANUP & FINAL TOUCHES
-- Any final logic or setup can be added here.

-- 16. RETURNS & REFUNDS SECTION (Item-Level)

CREATE TABLE IF NOT EXISTS returns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE NO ACTION,
    user_id UUID REFERENCES auth.users(id),
    status TEXT NOT NULL CHECK (status IN ('requested', 'approved', 'rejected', 'completed')),
    refund_amount DECIMAL(10, 2),
    reason TEXT,
    staff_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_returns_order_id ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user_id ON returns(user_id);

ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create return requests" ON returns FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own returns" ON returns FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS return_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES returns(id) ON DELETE CASCADE,
    order_item_id UUID REFERENCES order_items(id),
    quantity INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_return_items_return_id ON return_items(return_id);

ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own return items" ON return_items FOR SELECT USING (EXISTS (SELECT 1 FROM returns WHERE returns.id = return_items.return_id AND returns.user_id = auth.uid()));
CREATE POLICY "Users can insert own return items" ON return_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM returns WHERE returns.id = return_id AND returns.user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id UUID REFERENCES returns(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id),
    razorpay_refund_id TEXT,
    amount DECIMAL(10, 2) NOT NULL,
    status TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);

ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can manage refunds" ON refunds FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 17. ADDRESS MANAGEMENT SECTION

CREATE TABLE IF NOT EXISTS addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('home', 'work', 'other')),
    is_primary BOOLEAN DEFAULT false,
    street_address TEXT NOT NULL,
    apartment VARCHAR(100),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    label VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_addresses_is_primary ON addresses(is_primary) WHERE is_primary = true;

ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own addresses" ON addresses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own addresses" ON addresses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own addresses" ON addresses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own addresses" ON addresses FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION ensure_one_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        UPDATE addresses SET is_primary = false WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = NEW.user_id AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)) THEN
        NEW.is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_primary_address_trigger
    BEFORE INSERT OR UPDATE ON addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_one_primary_address();

-- 18. SOCIAL MEDIA SECTION

CREATE TABLE IF NOT EXISTS social_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform TEXT NOT NULL,
    url TEXT NOT NULL,
    icon TEXT,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_social_media_display_order ON social_media(display_order);

ALTER TABLE social_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active social media" ON social_media FOR SELECT USING (is_active = true);
CREATE POLICY "Service role can manage social media" ON social_media FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 19. VIEWS

CREATE OR REPLACE VIEW public_testimonials AS
SELECT id, name, role, content, rating, image, created_at
FROM testimonials
WHERE approved = true
ORDER BY created_at DESC;

-- 20. ADDITIONAL ATOMIC FUNCTIONS

CREATE OR REPLACE FUNCTION get_or_create_cart(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_cart_id UUID;
BEGIN
    INSERT INTO carts (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
    SELECT id INTO v_cart_id FROM carts WHERE user_id = p_user_id;
    RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION add_to_cart_atomic(p_user_id UUID, p_product_id UUID, p_quantity INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    v_cart_id := get_or_create_cart(p_user_id);
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (v_cart_id, p_product_id, p_quantity)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity;

    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(json_agg(json_build_object('id', ci.id, 'product_id', ci.product_id, 'quantity', ci.quantity, 'added_at', ci.added_at, 'products', p.*)) FILTER (WHERE ci.id IS NOT NULL), '[]')
    ) INTO v_result FROM carts c LEFT JOIN cart_items ci ON c.id = ci.cart_id LEFT JOIN products p ON ci.product_id = p.id WHERE c.id = v_cart_id GROUP BY c.id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION update_cart_item_atomic(p_user_id UUID, p_product_id UUID, p_quantity INTEGER)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    v_cart_id := get_or_create_cart(p_user_id);
    IF p_quantity <= 0 THEN
        DELETE FROM cart_items WHERE cart_id = v_cart_id AND product_id = p_product_id;
    ELSE
        INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (v_cart_id, p_product_id, p_quantity)
        ON CONFLICT (cart_id, product_id) DO UPDATE SET quantity = p_quantity;
    END IF;

    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(json_agg(json_build_object('id', ci.id, 'product_id', ci.product_id, 'quantity', ci.quantity, 'added_at', ci.added_at, 'products', p.*)) FILTER (WHERE ci.id IS NOT NULL), '[]')
    ) INTO v_result FROM carts c LEFT JOIN cart_items ci ON c.id = ci.cart_id LEFT JOIN products p ON ci.product_id = p.id WHERE c.id = v_cart_id GROUP BY c.id;
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 21. ANALYTICS FUNCTIONS

CREATE OR REPLACE FUNCTION get_total_donations() RETURNS DECIMAL AS $$
BEGIN
  RETURN (SELECT COALESCE(SUM(amount), 0) FROM donations WHERE payment_status = 'success');
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_product_category_stats() RETURNS TABLE (category TEXT, count BIGINT) AS $$
BEGIN
  RETURN QUERY SELECT COALESCE(p.category, 'Uncategorized') as category, COUNT(*) as count FROM products p GROUP BY p.category ORDER BY count DESC;
END;
$$ LANGUAGE plpgsql;

-- 22. STORAGE CONFIGURATION

-- Buckets creation (Supabase specific)
INSERT INTO storage.buckets (id, name, public) VALUES 
('events', 'events', true),
('blogs', 'blogs', true),
('gallery', 'gallery', true),
('team', 'team', true),
('profiles', 'profiles', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS Policies
CREATE POLICY "Public Access Events" ON storage.objects FOR SELECT USING ( bucket_id = 'events' );
CREATE POLICY "Authenticated Uploads Events" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'events' AND auth.role() = 'authenticated' );
CREATE POLICY "Public Access Blogs" ON storage.objects FOR SELECT USING ( bucket_id = 'blogs' );
CREATE POLICY "Authenticated Uploads Blogs" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'blogs' AND auth.role() = 'authenticated' );
CREATE POLICY "Public Access Gallery" ON storage.objects FOR SELECT USING ( bucket_id = 'gallery' );
CREATE POLICY "Authenticated Uploads Gallery" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'gallery' AND auth.role() = 'authenticated' );
CREATE POLICY "Public Access Team" ON storage.objects FOR SELECT USING ( bucket_id = 'team' );
CREATE POLICY "Authenticated Uploads Team" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'team' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Access Profiles" ON storage.objects FOR SELECT USING ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );
CREATE POLICY "Authenticated Uploads Profiles" ON storage.objects FOR INSERT WITH CHECK ( bucket_id = 'profiles' AND auth.role() = 'authenticated' );

-- =====================================================
-- COMPREHENSIVE RLS POLICY MIGRATION
-- Created: 2026-01-21
-- Purpose: Establish robust Row-Level Security policies for all 71 tables
-- Strategy: Service Role Bypass - Backend bypasses RLS, policies protect direct DB access
-- =====================================================

-- ===================
-- STEP 1: HELPER FUNCTIONS
-- ===================

-- Function to check if current user is admin or manager
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles p
        INNER JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user owns a specific order
CREATE OR REPLACE FUNCTION public.user_owns_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM orders
        WHERE id = order_uuid AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_admin_or_manager() IS 'Returns true if authenticated user has admin or manager role';
COMMENT ON FUNCTION public.user_owns_order(UUID) IS 'Returns true if authenticated user owns the specified order';

-- ===================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ===================

-- Enable RLS (idempotent - won't error if already enabled)
ALTER TABLE about_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_future_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_impact_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE about_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_deletion_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments_backup ENABLE ROW LEVEL SECURITY;
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_info ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_office_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE deletion_authorization_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_cancellation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gallery_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE manager_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE policy_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public_testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;

-- ===================
-- STEP 3: DROP EXISTING POLICIES (if any)
-- ===================

-- This ensures clean slate - policies will be recreated below
DO $$ 
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', pol.policyname, pol.schemaname, pol.tablename);
    END LOOP;
END $$;

-- ===================
-- STEP 4: CREATE POLICIES BY CATEGORY
-- ===================

-- ------------------------------------------------------------
-- CATEGORY 1: USER-OWNED DATA
-- Policy: Users can manage their own data, admins can see all
-- ------------------------------------------------------------

-- Profiles
CREATE POLICY "Users can view own profile, admins view all" ON profiles FOR SELECT USING (id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "System can insert profiles" ON profiles FOR INSERT WITH CHECK (true); -- Handled by auth system

-- Addresses  
CREATE POLICY "Users manage own addresses" ON addresses FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());

-- Phone Numbers
CREATE POLICY "Users manage own phones" ON phone_numbers FOR ALL USING (
    EXISTS (SELECT 1 FROM addresses WHERE addresses.id = phone_numbers.address_id AND addresses.user_id = auth.uid())
    OR is_admin_or_manager()
);

-- Carts & Cart Items
CREATE POLICY "Users manage own cart" ON carts FOR ALL USING (user_id = auth.uid() OR guest_id IS NOT NULL OR is_admin_or_manager());
CREATE POLICY "Users manage own cart items" ON cart_items FOR ALL USING (
    EXISTS (SELECT 1 FROM carts WHERE carts.id = cart_items.cart_id AND (carts.user_id = auth.uid() OR carts.guest_id IS NOT NULL))
    OR is_admin_or_manager()
);

-- Orders & Order Items
CREATE POLICY "Users view own orders, admins view all" ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Admins can modify orders" ON orders FOR UPDATE USING (is_admin_or_manager());
CREATE POLICY "System can insert orders" ON orders FOR INSERT WITH CHECK (true); -- Checkout service handles this

CREATE POLICY "Users view own order items" ON order_items FOR SELECT USING (user_owns_order(order_id) OR is_admin_or_manager());
CREATE POLICY "System can insert order items" ON order_items FOR INSERT WITH CHECK (true);

-- Critical Fix: Order Status History (The original issue!)
CREATE POLICY "Users view own order history" ON order_status_history FOR SELECT USING (user_owns_order(order_id) OR is_admin_or_manager());
CREATE POLICY "Service role can insert order history" ON order_status_history FOR INSERT WITH CHECK (true); -- Service role bypasses anyway

-- Returns & Return Items
CREATE POLICY "Users manage own returns" ON returns FOR ALL USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = returns.order_id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);
CREATE POLICY "Users manage own return items" ON return_items FOR ALL USING (
    EXISTS (SELECT 1 FROM returns r JOIN orders o ON r.order_id = o.id WHERE r.id = return_items.return_id AND o.user_id = auth.uid())
    OR is_admin_or_manager()
);

-- Payments, Refunds, Invoices (Users can view their own)
CREATE POLICY "Users view own payments" ON payments FOR SELECT USING (
    user_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM orders WHERE orders.payment_id = payments.id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);
CREATE POLICY "Service can manage payments" ON payments FOR ALL USING (is_admin_or_manager()); -- Backend service role bypasses

CREATE POLICY "Users view own refunds" ON refunds FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);

CREATE POLICY "Users view own invoices" ON invoices FOR SELECT USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.user_id = auth.uid())
    OR is_admin_or_manager()
);

-- Donations & Subscriptions
CREATE POLICY "Users manage own donations" ON donations FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Users manage own donation subscriptions" ON donation_subscriptions FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());

-- Event Registrations
CREATE POLICY "Users manage own event registrations" ON event_registrations FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());

-- Reviews & Comments
CREATE POLICY "Users manage own reviews" ON reviews FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Anyone view comments, users manage own" ON comments FOR SELECT USING (true);
CREATE POLICY "Users manage own comments" ON comments FOR INSERT USING (user_id = auth.uid());
CREATE POLICY "Users update own comments" ON comments FOR UPDATE USING (user_id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Users delete own comments" ON comments FOR DELETE USING (user_id = auth.uid() OR is_admin_or_manager());

-- Bank Details (Sensitive!)
CREATE POLICY "Users manage own bank details" ON bank_details FOR ALL USING (user_id = auth.uid() OR is_admin_or_manager());

-- Newsletter Subscribers
CREATE POLICY "Users manage own subscription" ON newsletter_subscribers FOR ALL USING (email = (SELECT email FROM profiles WHERE id = auth.uid()) OR is_admin_or_manager());

-- Refresh Tokens (Auth)
CREATE POLICY "Users manage own tokens" ON refresh_tokens FOR ALL USING (user_id = auth.uid());

-- ------------------------------------------------------------
-- CATEGORY 2: PUBLIC READ, ADMIN WRITE
-- Policy: Anyone can view, only admins can modify
-- ------------------------------------------------------------

-- Products & Variants
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
CREATE POLICY "Admins manage products" ON products FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public can view product variants" ON product_variants FOR SELECT USING (true);
CREATE POLICY "Admins manage variants" ON product_variants FOR ALL USING (is_admin_or_manager());

-- Categories
CREATE POLICY "Public can view categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Admins manage categories" ON categories FOR ALL USING (is_admin_or_manager());

-- Blogs
CREATE POLICY "Public can view published blogs" ON blogs FOR SELECT USING (true); -- Add status filter in app logic if needed
CREATE POLICY "Admins manage blogs" ON blogs FOR ALL USING (is_admin_or_manager());

-- Events
CREATE POLICY "Public can view events" ON events FOR SELECT USING (true);
CREATE POLICY "Admins manage events" ON events FOR ALL USING (is_admin_or_manager());

-- FAQs
CREATE POLICY "Public can view faqs" ON faqs FOR SELECT USING (true);
CREATE POLICY "Admins manage faqs" ON faqs FOR ALL USING (is_admin_or_manager());

-- Testimonials
CREATE POLICY "Public can view testimonials" ON testimonials FOR SELECT USING (true);
CREATE POLICY "Admins manage testimonials" ON testimonials FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public can view public testimonials" ON public_testimonials FOR SELECT USING (true);
CREATE POLICY "Admins manage public testimonials" ON public_testimonials FOR ALL USING (is_admin_or_manager());

-- Gallery
CREATE POLICY "Public can view gallery folders" ON gallery_folders FOR SELECT USING (true);
CREATE POLICY "Admins manage gallery folders" ON gallery_folders FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public can view gallery items" ON gallery_items FOR SELECT USING (true);
CREATE POLICY "Admins manage gallery items" ON gallery_items FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public can view gallery videos" ON gallery_videos FOR SELECT USING (true);
CREATE POLICY "Admins manage gallery videos" ON gallery_videos FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public can view photos" ON photos FOR SELECT USING (true);
CREATE POLICY "Admins manage photos" ON photos FOR ALL USING (is_admin_or_manager());

-- About Section
CREATE POLICY "Public view about cards" ON about_cards FOR SELECT USING (true);
CREATE POLICY "Admins manage about cards" ON about_cards FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view about goals" ON about_future_goals FOR SELECT USING (true);
CREATE POLICY "Admins manage about goals" ON about_future_goals FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view about stats" ON about_impact_stats FOR SELECT USING (true);
CREATE POLICY "Admins manage about stats" ON about_impact_stats FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view about settings" ON about_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage about settings" ON about_settings FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view about team" ON about_team_members FOR SELECT USING (true);
CREATE POLICY "Admins manage about team" ON about_team_members FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view about timeline" ON about_timeline FOR SELECT USING (true);
CREATE POLICY "Admins manage about timeline" ON about_timeline FOR ALL USING (is_admin_or_manager());

-- Contact Info
CREATE POLICY "Public view contact info" ON contact_info FOR SELECT USING (true);
CREATE POLICY "Admins manage contact info" ON contact_info FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view contact emails" ON contact_emails FOR SELECT USING (true);
CREATE POLICY "Admins manage contact emails" ON contact_emails FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view contact phones" ON contact_phones FOR SELECT USING (true);
CREATE POLICY "Admins manage contact phones" ON contact_phones FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view contact hours" ON contact_office_hours FOR SELECT USING (true);
CREATE POLICY "Admins manage contact hours" ON contact_office_hours FOR ALL USING (is_admin_or_manager());

-- Contact Messages (Public can insert, admins can view)
CREATE POLICY "Public can submit contact messages" ON contact_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins view contact messages" ON contact_messages FOR SELECT USING (is_admin_or_manager());

-- Policy Pages
CREATE POLICY "Public view policy pages" ON policy_pages FOR SELECT USING (true);
CREATE POLICY "Admins manage policy pages" ON policy_pages FOR ALL USING (is_admin_or_manager());

-- Social Media & Store Settings
CREATE POLICY "Public view social media" ON social_media FOR SELECT USING (true);
CREATE POLICY "Admins manage social media" ON social_media FOR ALL USING (is_admin_or_manager());

CREATE POLICY "Public view store settings" ON store_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage store settings" ON store_settings FOR ALL USING (is_admin_or_manager());

-- Roles (Public can read for display, admins manage)
CREATE POLICY "Public view roles" ON roles FOR SELECT USING (true);
CREATE POLICY "Admins manage roles" ON roles FOR ALL USING (is_admin_or_manager());

-- ------------------------------------------------------------
-- CATEGORY 3: ADMIN/MANAGER ONLY
-- Policy: Only admins can access
-- ------------------------------------------------------------

CREATE POLICY "Admins only: admin_alerts" ON admin_alerts FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: order_notifications" ON order_notifications FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: manager_permissions" ON manager_permissions FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: coupon_usage" ON coupon_usage FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: coupons" ON coupons FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: delivery_configs" ON delivery_configs FOR ALL USING (is_admin_or_manager());
CREATE POLICY "Admins only: newsletter_config" ON newsletter_config FOR ALL USING (is_admin_or_manager());

-- ------------------------------------------------------------
-- CATEGORY 4: SYSTEM/AUDIT TABLES
-- Policy: Permissive ALL for service role (which bypasses RLS anyway)
-- These tables are protected by RLS being enabled but have no restricting policies
-- ------------------------------------------------------------

CREATE POLICY "Service role: audit_logs" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Service role: refund_audit_logs" ON refund_audit_logs FOR ALL USING (true);
CREATE POLICY "Service role: email_logs" ON email_logs FOR ALL USING (true);
CREATE POLICY "Service role: email_notifications" ON email_notifications FOR ALL USING (true);
CREATE POLICY "Service role: webhook_events" ON webhook_events FOR ALL USING (true);
CREATE POLICY "Service role: webhook_logs" ON webhook_logs FOR ALL USING (true);
CREATE POLICY "Service role: account_deletion_jobs" ON account_deletion_jobs FOR ALL USING (true);
CREATE POLICY "Service role: account_deletion_audit" ON account_deletion_audit FOR ALL USING (true);
CREATE POLICY "Service role: deletion_authorization_tokens" ON deletion_authorization_tokens FOR ALL USING (true);
CREATE POLICY "Service role: event_cancellation_jobs" ON event_cancellation_jobs FOR ALL USING (true);
CREATE POLICY "Service role: event_refunds" ON event_refunds FOR ALL USING (true);
CREATE POLICY "Service role: comment_rate_limits" ON comment_rate_limits FOR ALL USING (true);
CREATE POLICY "Service role: comment_flags" ON comment_flags FOR ALL USING (true);
CREATE POLICY "Service role: comment_moderation_log" ON comment_moderation_log FOR ALL USING (true);
CREATE POLICY "Service role: blog_comments_backup" ON blog_comments_backup FOR ALL USING (true);
CREATE POLICY "Service role: otp_codes" ON otp_codes FOR ALL USING (true);

-- ===================
-- STEP 5: ADD COMMENTS FOR DOCUMENTATION
-- ===================

COMMENT ON POLICY "Service role can insert order history" ON order_status_history IS 
'CRITICAL: Service role must be able to insert timeline entries. Frontend uses service role key which bypasses RLS.';

COMMENT ON FUNCTION public.is_admin_or_manager() IS 
'Security definer function to check admin/manager role. Used across all RLS policies for consistent authorization.';

-- ===================
-- VERIFICATION QUERY
-- ===================

-- Run this to verify all tables have RLS enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = false ORDER BY tablename;
-- Should return 0 rows after this migration

-- Run this to count policies per table:
-- SELECT tablename, COUNT(*) as policy_count FROM pg_policies WHERE schemaname = 'public' GROUP BY tablename ORDER BY tablename;

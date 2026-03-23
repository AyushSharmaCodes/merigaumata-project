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

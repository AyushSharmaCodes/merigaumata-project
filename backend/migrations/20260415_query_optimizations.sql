-- ================================================================
-- Migration: Query Optimizations (RPCs and Joins)
-- Date: 2026-04-15
-- Description: Consolidates sequential DB calls into single RPCs 
-- to minimize round trips and improve performance.
-- ================================================================

-- 1. Create Manager with Permissions (Atomic)
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

    -- 4. Insert Permissions
    INSERT INTO public.manager_permissions (
        user_id, is_active,
        can_manage_products, can_manage_categories, can_manage_orders,
        can_manage_events, can_manage_blogs, can_manage_testimonials,
        can_add_testimonials, can_approve_testimonials, can_manage_gallery,
        can_manage_faqs, can_manage_carousel, can_manage_contact_info,
        can_manage_social_media, can_manage_bank_details, can_manage_about_us,
        can_manage_newsletter, can_manage_reviews, can_manage_policies,
        can_manage_contact_messages, can_manage_coupons, can_manage_background_jobs,
        can_manage_delivery_configs
    ) VALUES (
        p_user_id, true,
        COALESCE((p_permissions->>'can_manage_products')::boolean, false),
        COALESCE((p_permissions->>'can_manage_categories')::boolean, false),
        COALESCE((p_permissions->>'can_manage_orders')::boolean, false),
        COALESCE((p_permissions->>'can_manage_events')::boolean, false),
        COALESCE((p_permissions->>'can_manage_blogs')::boolean, false),
        COALESCE((p_permissions->>'can_manage_testimonials')::boolean, false),
        COALESCE((p_permissions->>'can_add_testimonials')::boolean, false),
        COALESCE((p_permissions->>'can_approve_testimonials')::boolean, false),
        COALESCE((p_permissions->>'can_manage_gallery')::boolean, false),
        COALESCE((p_permissions->>'can_manage_faqs')::boolean, false),
        COALESCE((p_permissions->>'can_manage_carousel')::boolean, false),
        COALESCE((p_permissions->>'can_manage_contact_info')::boolean, false),
        COALESCE((p_permissions->>'can_manage_social_media')::boolean, false),
        COALESCE((p_permissions->>'can_manage_bank_details')::boolean, false),
        COALESCE((p_permissions->>'can_manage_about_us')::boolean, false),
        COALESCE((p_permissions->>'can_manage_newsletter')::boolean, false),
        COALESCE((p_permissions->>'can_manage_reviews')::boolean, false),
        COALESCE((p_permissions->>'can_manage_policies')::boolean, false),
        COALESCE((p_permissions->>'can_manage_contact_messages')::boolean, false),
        COALESCE((p_permissions->>'can_manage_coupons')::boolean, false),
        COALESCE((p_permissions->>'can_manage_background_jobs')::boolean, false),
        COALESCE((p_permissions->>'can_manage_delivery_configs')::boolean, false)
    )
    RETURNING to_jsonb(public.manager_permissions.*) INTO v_perm_result;

    RETURN jsonb_build_object(
        'profile', v_profile_result,
        'permissions', v_perm_result
    );
END;
$$;

-- 1b. Delete Manager (Atomic)
CREATE OR REPLACE FUNCTION public.delete_manager_v1(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Delete permissions
    DELETE FROM public.manager_permissions WHERE user_id = p_user_id;
    -- 2. Delete profile (cascades to auth_accounts, etc. if linked)
    DELETE FROM public.profiles WHERE id = p_user_id;
END;
$$;

-- 2. Bulk Reorder FAQs
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

-- 3. Upsert Product with Delivery Config
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

-- 4. Checkout Prelim (Profile + Cart + Order Number)
-- Consolidates multiple frontend-to-backend round trips during checkout
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

-- 5. Atomic Cart Upsert (v1)
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
    WHERE cart_id = v_cart_id 
      AND (product_id, variant_id) IS NOT DISTINCT FROM (p_product_id, p_variant_id);

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
        WHERE cart_id = v_cart_id 
          AND (product_id, variant_id) IS NOT DISTINCT FROM (p_product_id, p_variant_id);
    ELSIF v_current_qty > 0 THEN
        UPDATE public.cart_items 
        SET quantity = v_new_qty, added_at = NOW()
        WHERE cart_id = v_cart_id 
          AND (product_id, variant_id) IS NOT DISTINCT FROM (p_product_id, p_variant_id);
    ELSE
        INSERT INTO public.cart_items (cart_id, product_id, variant_id, quantity)
        VALUES (v_cart_id, p_product_id, p_variant_id, v_new_qty);
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

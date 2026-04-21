-- ==============================================================================
-- MIGRATION: 20260419_fix_order_and_product_rpc.sql
-- PURPOSE: 
-- 1. Fix Product Variants RPCs (price -> selling_price)
-- 2. Restore all 15+ missing fields to create_order_transactional that were 
--    overwritten by 20260417_inventory_rpc_refactor.sql, while keeping its atomic
--    inventory locking.
-- ==============================================================================

BEGIN;

-- 1. FIX: `create_product_with_variants`
DROP FUNCTION IF EXISTS public.create_product_with_variants(JSONB, JSONB);
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
        title_i18n, description_i18n, tags_i18n, benefits_i18n,
        default_hsn_code, default_gst_rate, default_tax_applicable, default_price_includes_tax, variant_mode
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
        COALESCE((p_product_data->>'default_price_includes_tax')::BOOLEAN, false),
        COALESCE(p_product_data->>'variant_mode', 'UNIT')::variant_mode_type
    )
    RETURNING id INTO v_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        INSERT INTO public.product_variants (
            product_id, size_label, size_label_i18n, size_value, unit, description, description_i18n,
            variant_image_url, sku, selling_price, mrp, stock_quantity, is_default, is_active,
            tax_applicable, gst_rate, price_includes_tax, hsn_code, delivery_charge
        ) VALUES (
            v_product_id,
            v_variant->>'size_label',
            COALESCE(v_variant->'size_label_i18n', '{}'::jsonb),
            COALESCE(NULLIF(v_variant->>'size_value', '')::NUMERIC, 0),
            COALESCE(v_variant->>'unit', 'kg'),
            v_variant->>'description',
            COALESCE(v_variant->'description_i18n', '{}'::jsonb),
            v_variant->>'variant_image_url',
            v_variant->>'sku',
            COALESCE((v_variant->>'selling_price')::NUMERIC, 0),
            NULLIF(v_variant->>'mrp', '')::NUMERIC,
            COALESCE((v_variant->>'stock_quantity')::INTEGER, 0),
            COALESCE((v_variant->>'is_default')::BOOLEAN, false),
            COALESCE((v_variant->>'is_active')::BOOLEAN, true),
            COALESCE((v_variant->>'tax_applicable')::BOOLEAN, true),
            COALESCE((v_variant->>'gst_rate')::NUMERIC, 0),
            COALESCE((v_variant->>'price_includes_tax')::BOOLEAN, true),
            v_variant->>'hsn_code',
            NULLIF(v_variant->>'delivery_charge', '')::NUMERIC
        )
        RETURNING id INTO v_variant_id;
        v_variant_ids := array_append(v_variant_ids, v_variant_id);
    END LOOP;

    RETURN jsonb_build_object('id', v_product_id, 'variant_ids', v_variant_ids);
END;
$$;

-- 2. FIX: `update_product_with_variants`
DROP FUNCTION IF EXISTS public.update_product_with_variants(UUID, JSONB, JSONB);
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
        images = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'images', '[]'::jsonb))), images),
        tags = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'tags', '[]'::jsonb))), tags),
        benefits = COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'benefits', '[]'::jsonb))), benefits),
        inventory = COALESCE((p_product_data->>'inventory')::INTEGER, inventory),
        is_returnable = COALESCE((p_product_data->>'is_returnable')::BOOLEAN, is_returnable),
        return_days = COALESCE((p_product_data->>'return_days')::INTEGER, return_days),
        is_new = COALESCE((p_product_data->>'is_new')::BOOLEAN, is_new),
        variant_mode = COALESCE(p_product_data->>'variant_mode', variant_mode::text)::variant_mode_type,
        updated_at = NOW()
    WHERE id = p_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        IF NULLIF(v_variant->>'id', '') IS NOT NULL THEN
            UPDATE public.product_variants
            SET
                size_label = COALESCE(v_variant->>'size_label', size_label),
                size_label_i18n = COALESCE(v_variant->'size_label_i18n', size_label_i18n),
                size_value = COALESCE(NULLIF(v_variant->>'size_value', '')::NUMERIC, size_value),
                unit = COALESCE(v_variant->>'unit', unit),
                description = COALESCE(v_variant->>'description', description),
                description_i18n = COALESCE(v_variant->'description_i18n', description_i18n),
                variant_image_url = COALESCE(v_variant->>'variant_image_url', variant_image_url),
                sku = COALESCE(v_variant->>'sku', sku),
                selling_price = COALESCE(NULLIF(v_variant->>'selling_price', '')::NUMERIC, selling_price),
                mrp = COALESCE(NULLIF(v_variant->>'mrp', '')::NUMERIC, mrp),
                stock_quantity = COALESCE(NULLIF(v_variant->>'stock_quantity', '')::INTEGER, stock_quantity),
                is_default = COALESCE((v_variant->>'is_default')::BOOLEAN, is_default),
                is_active = COALESCE((v_variant->>'is_active')::BOOLEAN, is_active),
                tax_applicable = COALESCE((v_variant->>'tax_applicable')::BOOLEAN, tax_applicable),
                gst_rate = COALESCE(NULLIF(v_variant->>'gst_rate', '')::NUMERIC, gst_rate),
                price_includes_tax = COALESCE((v_variant->>'price_includes_tax')::BOOLEAN, price_includes_tax),
                hsn_code = COALESCE(v_variant->>'hsn_code', hsn_code),
                delivery_charge = COALESCE(NULLIF(v_variant->>'delivery_charge', '')::NUMERIC, delivery_charge),
                updated_at = NOW()
            WHERE id = (v_variant->>'id')::UUID
            RETURNING id INTO v_variant_id;
            v_updated := array_append(v_updated, v_variant_id);
        ELSE
            INSERT INTO public.product_variants (
                product_id, size_label, size_label_i18n, size_value, unit, description, description_i18n,
                variant_image_url, sku, selling_price, mrp, stock_quantity, is_default, is_active,
                tax_applicable, gst_rate, price_includes_tax, hsn_code, delivery_charge
            ) VALUES (
                p_product_id,
                v_variant->>'size_label',
                COALESCE(v_variant->'size_label_i18n', '{}'::jsonb),
                COALESCE((v_variant->>'size_value')::NUMERIC, 0),
                COALESCE(v_variant->>'unit', 'kg'),
                v_variant->>'description',
                COALESCE(v_variant->'description_i18n', '{}'::jsonb),
                v_variant->>'variant_image_url',
                v_variant->>'sku',
                COALESCE((v_variant->>'selling_price')::NUMERIC, 0),
                NULLIF(v_variant->>'mrp', '')::NUMERIC,
                COALESCE((v_variant->>'stock_quantity')::INTEGER, 0),
                COALESCE((v_variant->>'is_default')::BOOLEAN, false),
                COALESCE((v_variant->>'is_active')::BOOLEAN, true),
                COALESCE((v_variant->>'tax_applicable')::BOOLEAN, true),
                COALESCE((v_variant->>'gst_rate')::NUMERIC, 0),
                COALESCE((v_variant->>'price_includes_tax')::BOOLEAN, true),
                v_variant->>'hsn_code',
                NULLIF(v_variant->>'delivery_charge', '')::NUMERIC
            )
            RETURNING id INTO v_variant_id;
            v_created := array_append(v_created, v_variant_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('id', p_product_id, 'new_variants', v_created, 'updated_variants', v_updated);
END;
$$;

-- 3. FIX: `create_order_transactional` (Combines atomic locking with the 15+ rich metadata fields)
DROP FUNCTION IF EXISTS public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.create_order_transactional(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
    p_payment_id UUID DEFAULT NULL,
    p_cart_id UUID DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_order_number TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_item JSONB;
    v_order_number TEXT;
    v_variant_id UUID;
    v_product_id UUID;
    v_qty INTEGER;
    v_updated_rows INTEGER;
BEGIN
    -- 1. Generate Order Number
    v_order_number := COALESCE(NULLIF(p_order_number, ''), public.generate_next_order_number());

    -- 2. ATOMIC INVENTORY DEDUCTION (Locking Sequence: Variant First, then Base Product)
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order_items, '[]'::jsonb))
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;

        IF v_variant_id IS NOT NULL THEN
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
            WHERE id = v_variant_id AND stock_quantity >= v_qty;

            GET DIAGNOSTICS v_updated_rows := ROW_COUNT;
            IF v_updated_rows = 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK: Variant % is out of stock', v_variant_id;
            END IF;
        ELSIF v_product_id IS NOT NULL THEN
            UPDATE public.products
            SET inventory = inventory - v_qty, updated_at = NOW()
            WHERE id = v_product_id AND inventory >= v_qty;

            GET DIAGNOSTICS v_updated_rows := ROW_COUNT;
            IF v_updated_rows = 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % is out of stock', v_product_id;
            END IF;
        END IF;
    END LOOP;

    -- 3. Create Order
    INSERT INTO public.orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address_id, billing_address_id, shipping_address, billing_address,
        total_amount, subtotal, coupon_code, coupon_discount, delivery_charge, delivery_gst,
        status, payment_status, items, metadata, version
    ) VALUES (
        v_order_number, p_user_id,
        p_order_data->>'customer_name', p_order_data->>'customer_email', p_order_data->>'customer_phone',
        NULLIF(p_order_data->>'shipping_address_id', '')::UUID, NULLIF(p_order_data->>'billing_address_id', '')::UUID,
        COALESCE(p_order_data->'shipping_address', '{}'::jsonb), COALESCE(p_order_data->'billing_address', '{}'::jsonb),
        COALESCE((p_order_data->>'total_amount')::NUMERIC, 0), COALESCE((p_order_data->>'subtotal')::NUMERIC, 0),
        p_coupon_code, COALESCE((p_order_data->>'coupon_discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0), COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        'pending', 'pending',
        COALESCE(p_order_items, '[]'::jsonb), COALESCE(p_order_data->'metadata', '{}'::jsonb),
        0
    ) RETURNING id INTO v_order_id;

    -- 4. Create Order Items (RESTORED ALL METADATA FIELDS)
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order_items, '[]'::jsonb))
    LOOP
        INSERT INTO public.order_items (
            order_id, 
            product_id, 
            variant_id, 
            title, 
            quantity, 
            price_per_unit, 
            mrp,
            is_returnable,
            returned_quantity,
            taxable_amount,
            cgst,
            sgst,
            igst,
            gst_rate,
            hsn_code,
            delivery_charge,
            delivery_gst,
            total_amount,
            variant_snapshot,
            delivery_calculation_snapshot,
            coupon_id,
            coupon_code,
            coupon_discount,
            tax_snapshot
        ) VALUES (
            v_order_id,
            NULLIF(v_item->>'product_id', '')::UUID,
            NULLIF(v_item->>'variant_id', '')::UUID,
            COALESCE(v_item->'product'->>'title', 'Product'),
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->'product'->>'price')::NUMERIC, 0),
            NULLIF(v_item->'variant_snapshot'->>'mrp', '')::NUMERIC,
            COALESCE((v_item->'product'->>'isReturnable')::BOOLEAN, TRUE),
            0,
            COALESCE((v_item->>'taxable_amount')::NUMERIC, 0),
            COALESCE((v_item->>'cgst')::NUMERIC, 0),
            COALESCE((v_item->>'sgst')::NUMERIC, 0),
            COALESCE((v_item->>'igst')::NUMERIC, 0),
            COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
            v_item->>'hsn_code',
            COALESCE((v_item->>'delivery_charge')::NUMERIC, 0),
            COALESCE((v_item->>'delivery_gst')::NUMERIC, 0),
            COALESCE((v_item->>'total_amount')::NUMERIC, 0),
            v_item->'variant_snapshot',
            v_item->'delivery_calculation_snapshot',
            NULLIF(v_item->>'coupon_id', '')::UUID,
            v_item->>'coupon_code',
            COALESCE((v_item->>'coupon_discount')::NUMERIC, 0),
            NULL
        );
    END LOOP;

    -- 5. Cleanup & Associations
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

    -- 6. Status History
    INSERT INTO public.order_status_history (order_id, status, updated_by, actor, notes, event_type)
    VALUES (v_order_id, 'ORDER_PLACED', p_user_id, 'SYSTEM', 'Order created transactionally', 'STATUS_CHANGE');

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'success', true
    );
END;
$$;

COMMIT;

-- 4. FIX: `get_product_detail_consolidated` (Re-create to flush cached `v.*` row types)
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

-- 5. Force PostgREST schema reload to ensure new columns are visible
NOTIFY pgrst, 'reload schema';

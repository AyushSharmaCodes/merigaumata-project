-- ==============================================================================
-- MIGRATION: 20260417_inventory_rpc_refactor.sql
-- PURPOSE: Atomic stock deduction with strict validation.
-- ==============================================================================

BEGIN;

-- 1. Harden batch_decrement_inventory_atomic
DROP FUNCTION IF EXISTS public.batch_decrement_inventory_atomic(JSONB);
CREATE OR REPLACE FUNCTION public.batch_decrement_inventory_atomic(p_items JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_variant_id UUID;
    v_product_id UUID;
    v_qty INTEGER;
    v_updated_rows INTEGER;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;

        IF v_variant_id IS NOT NULL THEN
            -- ATOMIC UPDATE WITH RETURNING
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
            WHERE id = v_variant_id AND stock_quantity >= v_qty;
            
            GET DIAGNOSTICS v_updated_rows := ROW_COUNT;
            IF v_updated_rows = 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK: Variant % has insufficient quantity', v_variant_id;
            END IF;
        ELSIF v_product_id IS NOT NULL THEN
            UPDATE public.products
            SET inventory = inventory - v_qty, updated_at = NOW()
            WHERE id = v_product_id AND inventory >= v_qty;

            GET DIAGNOSTICS v_updated_rows := ROW_COUNT;
            IF v_updated_rows = 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK: Product % has insufficient quantity', v_product_id;
            END IF;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true);
END;
$$;

-- 2. Refactor create_order_transactional to include Inventory Deduction
-- Note: This is an additive refactor (p_data + p_items + inventory check)
DROP FUNCTION IF EXISTS public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT);
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
    v_variant_id UUID;
    v_qty INTEGER;
    v_updated_rows INTEGER;
BEGIN
    -- 1. Generate Order Number
    v_order_number := COALESCE(NULLIF(p_order_number, ''), public.generate_next_order_number());

    -- 2. ATOMIC INVENTORY DEDUCTION (Locking Sequence: Variant First)
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order_items, '[]'::jsonb))
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 1);
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;

        IF v_variant_id IS NOT NULL THEN
            -- LOCK AND UPDATE
            UPDATE public.product_variants
            SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
            WHERE id = v_variant_id AND stock_quantity >= v_qty;

            GET DIAGNOSTICS v_updated_rows := ROW_COUNT;
            IF v_updated_rows = 0 THEN
                RAISE EXCEPTION 'INSUFFICIENT_STOCK: Variant % is out of stock', v_variant_id;
            END IF;
        END IF;
    END LOOP;

    -- 3. Create Order
    INSERT INTO public.orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address_id, billing_address_id, shipping_address, billing_address,
        total_amount, subtotal, coupon_code, coupon_discount, delivery_charge, delivery_gst,
        status, payment_status, items, metadata
    ) VALUES (
        v_order_number, p_user_id,
        p_order_data->>'customer_name', p_order_data->>'customer_email', p_order_data->>'customer_phone',
        NULLIF(p_order_data->>'shipping_address_id', '')::UUID, NULLIF(p_order_data->>'billing_address_id', '')::UUID,
        COALESCE(p_order_data->'shipping_address', '{}'::jsonb), COALESCE(p_order_data->'billing_address', '{}'::jsonb),
        COALESCE((p_order_data->>'total_amount')::NUMERIC, 0), COALESCE((p_order_data->>'subtotal')::NUMERIC, 0),
        p_coupon_code, COALESCE((p_order_data->>'coupon_discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0), COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        'pending', 'pending',
        COALESCE(p_order_items, '[]'::jsonb), COALESCE(p_order_data->'metadata', '{}'::jsonb)
    ) RETURNING id INTO v_order_id;

    -- 4. Create Order Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_order_items, '[]'::jsonb))
    LOOP
        INSERT INTO public.order_items (
            order_id, product_id, variant_id, title, quantity, price_per_unit, mrp
        ) VALUES (
            v_order_id,
            NULLIF(v_item->>'product_id', '')::UUID,
            NULLIF(v_item->>'variant_id', '')::UUID,
            v_item->>'title',
            COALESCE((v_item->>'quantity')::INTEGER, 1),
            COALESCE((v_item->>'price_per_unit')::NUMERIC, 0),
            NULLIF(v_item->>'mrp', '')::NUMERIC
        );
    END LOOP;

    -- 5. Cleanup (Cart, Payments, Coupon)
    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments SET order_id = v_order_id WHERE id = p_payment_id;
    END IF;
    IF p_cart_id IS NOT NULL THEN
        DELETE FROM public.cart_items WHERE cart_id = p_cart_id;
    END IF;

    RETURN jsonb_build_object('id', v_order_id, 'order_number', v_order_number, 'success', true);
END;
$$;

COMMIT;

-- ==============================================================================
-- MIGRATION: 20260419_repair_checkout_order_rpc.sql
-- PURPOSE:
-- 1. Restore all checkout-critical columns on orders/order_items/payments
-- 2. Recreate the 7-parameter create_order_transactional RPC expected by checkout
-- ==============================================================================

BEGIN;

-- 1. payments.invoice_id must be TEXT for Razorpay invoice ids
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'payments'
          AND column_name = 'invoice_id'
          AND data_type = 'uuid'
    ) THEN
        ALTER TABLE public.payments
            ALTER COLUMN invoice_id TYPE TEXT
            USING invoice_id::text;
    END IF;
END $$;

-- 2. Repair orders table so the current checkout RPC can insert rich order metadata
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'billing_address_id') THEN
        ALTER TABLE public.orders ADD COLUMN billing_address_id UUID REFERENCES public.addresses(id) ON DELETE SET NULL;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'billing_address') THEN
        ALTER TABLE public.orders ADD COLUMN billing_address JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_gst') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_gst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'is_delivery_refundable') THEN
        ALTER TABLE public.orders ADD COLUMN is_delivery_refundable BOOLEAN DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_tax_type') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_tax_type TEXT DEFAULT 'GST';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_taxable_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_taxable_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_cgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_cgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_sgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_sgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_igst') THEN
        ALTER TABLE public.orders ADD COLUMN total_igst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'metadata') THEN
        ALTER TABLE public.orders ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'version') THEN
        ALTER TABLE public.orders ADD COLUMN version INTEGER DEFAULT 0;
    END IF;
END $$;

UPDATE public.orders
SET
    delivery_gst = COALESCE(delivery_gst, 0),
    is_delivery_refundable = COALESCE(is_delivery_refundable, true),
    delivery_tax_type = COALESCE(NULLIF(delivery_tax_type, ''), 'GST'),
    total_taxable_amount = COALESCE(total_taxable_amount, 0),
    total_cgst = COALESCE(total_cgst, 0),
    total_sgst = COALESCE(total_sgst, 0),
    total_igst = COALESCE(total_igst, 0),
    metadata = COALESCE(metadata, '{}'::jsonb),
    version = COALESCE(version, 0)
WHERE true;

-- 3. Repair order_items table to match the current RPC payload
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'mrp') THEN
        ALTER TABLE public.order_items ADD COLUMN mrp NUMERIC(12,2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'delivery_charge') THEN
        ALTER TABLE public.order_items ADD COLUMN delivery_charge NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'delivery_gst') THEN
        ALTER TABLE public.order_items ADD COLUMN delivery_gst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'taxable_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN taxable_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'cgst') THEN
        ALTER TABLE public.order_items ADD COLUMN cgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'sgst') THEN
        ALTER TABLE public.order_items ADD COLUMN sgst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'igst') THEN
        ALTER TABLE public.order_items ADD COLUMN igst NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'gst_rate') THEN
        ALTER TABLE public.order_items ADD COLUMN gst_rate NUMERIC(5,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'hsn_code') THEN
        ALTER TABLE public.order_items ADD COLUMN hsn_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN total_amount NUMERIC(12,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN variant_snapshot JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'delivery_calculation_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN delivery_calculation_snapshot JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'tax_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN tax_snapshot JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'coupon_id') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_id UUID;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'coupon_code') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'coupon_discount') THEN
        ALTER TABLE public.order_items ADD COLUMN coupon_discount NUMERIC(12,2) DEFAULT 0;
    END IF;
END $$;

UPDATE public.order_items
SET
    delivery_charge = COALESCE(delivery_charge, 0),
    delivery_gst = COALESCE(delivery_gst, 0),
    taxable_amount = COALESCE(taxable_amount, 0),
    cgst = COALESCE(cgst, 0),
    sgst = COALESCE(sgst, 0),
    igst = COALESCE(igst, 0),
    gst_rate = COALESCE(gst_rate, 0),
    total_amount = COALESCE(total_amount, 0),
    coupon_discount = COALESCE(coupon_discount, 0)
WHERE true;

-- 4. Repair order_status_history notes column for current checkout RPC writes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'order_status_history'
          AND column_name = 'notes'
    ) THEN
        ALTER TABLE public.order_status_history ADD COLUMN notes TEXT;
    END IF;
END $$;

-- 5. Recreate the checkout RPC expected by backend/services/checkout.service.js
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
    v_order_number := COALESCE(NULLIF(p_order_number, ''), public.generate_next_order_number());

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

    INSERT INTO public.orders (
        order_number, user_id, customer_name, customer_email, customer_phone,
        shipping_address_id, billing_address_id, shipping_address, billing_address,
        total_amount, subtotal, coupon_code, coupon_discount, delivery_charge, delivery_gst,
        status, payment_status, items, metadata, version,
        is_delivery_refundable, delivery_tax_type,
        total_taxable_amount, total_cgst, total_sgst, total_igst
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
        0,
        COALESCE((p_order_data->>'is_delivery_refundable')::BOOLEAN, TRUE),
        COALESCE(p_order_data->>'delivery_tax_type', 'GST'),
        COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_igst')::NUMERIC, 0)
    ) RETURNING id INTO v_order_id;

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
            v_item->'tax_snapshot'
        );
    END LOOP;

    IF p_payment_id IS NOT NULL THEN
        UPDATE public.payments
        SET order_id = v_order_id, updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    IF p_coupon_code IS NOT NULL THEN
        UPDATE public.coupons
        SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW()
        WHERE code = p_coupon_code;
    END IF;

    IF p_cart_id IS NOT NULL THEN
        DELETE FROM public.cart_items WHERE cart_id = p_cart_id;
        DELETE FROM public.carts WHERE id = p_cart_id;
    END IF;

    INSERT INTO public.order_status_history (order_id, status, updated_by, actor, notes, event_type)
    VALUES (v_order_id, 'ORDER_PLACED', p_user_id, 'SYSTEM', 'Order created transactionally', 'STATUS_CHANGE');

    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'success', true
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) TO service_role;

COMMIT;

NOTIFY pgrst, 'reload schema';

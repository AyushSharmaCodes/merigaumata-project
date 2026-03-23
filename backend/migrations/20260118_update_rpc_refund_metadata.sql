-- Migration: Update create_order_transactional RPC to handle refund metadata
-- File: backend/migrations/20260118_update_rpc_refund_metadata.sql

CREATE OR REPLACE FUNCTION create_order_transactional(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
    p_payment_id UUID DEFAULT NULL,
    p_cart_id UUID DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_order_record RECORD;
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_quantity INT;
BEGIN
    -- Generate order number
    SELECT 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || 
           LPAD((COALESCE(
               (SELECT CAST(SUBSTRING(order_number FROM 12) AS INT) + 1
                FROM orders 
                WHERE order_number LIKE 'ORD' || TO_CHAR(NOW(), 'YYYYMMDD') || '%'
                ORDER BY order_number DESC 
                LIMIT 1), 
               1
           ))::TEXT, 4, '0')
    INTO v_order_number;

    -- CREATE ORDER (with refund metadata)
    INSERT INTO orders (
        user_id,
        order_number,
        customer_name,
        customer_email,
        customer_phone,
        shipping_address_id,
        billing_address_id,
        shipping_address,
        items,
        total_amount,
        subtotal,
        coupon_code,
        coupon_discount,
        delivery_charge,
        delivery_gst,
        is_delivery_refundable,  -- NEW COLUMN
        delivery_tax_type,       -- NEW COLUMN
        status,
        payment_status,
        notes,
        created_at,
        updated_at,
        total_taxable_amount,
        total_cgst,
        total_sgst,
        total_igst
    )
    SELECT
        p_user_id,
        v_order_number,
        p_order_data->>'customer_name',
        p_order_data->>'customer_email',
        p_order_data->>'customer_phone',
        (p_order_data->>'shipping_address_id')::UUID,
        (p_order_data->>'billing_address_id')::UUID,
        p_order_data->'shipping_address',
        p_order_items,
        (p_order_data->>'total_amount')::NUMERIC,
        (p_order_data->>'subtotal')::NUMERIC,
        p_order_data->>'coupon_code',
        (p_order_data->>'coupon_discount')::NUMERIC,
        (p_order_data->>'delivery_charge')::NUMERIC,
        COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        COALESCE((p_order_data->>'is_delivery_refundable')::BOOLEAN, TRUE), -- NEW
        COALESCE(p_order_data->>'delivery_tax_type', 'GST'),                -- NEW
        COALESCE(p_order_data->>'status', 'confirmed'),
        COALESCE(p_order_data->>'payment_status', 'paid'),
        p_order_data->>'notes',
        NOW(),
        NOW(),
        COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_igst')::NUMERIC, 0)
    RETURNING id INTO v_order_id;

    -- CREATE ORDER ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;

        INSERT INTO order_items (
            order_id,
            product_id,
            variant_id,
            title,
            quantity,
            price_per_unit,
            is_returnable,
            returned_quantity,
            taxable_amount,
            cgst,
            sgst,
            igst,
            hsn_code,
            gst_rate,
            total_amount,
            variant_snapshot,
            delivery_charge,
            delivery_gst,
            delivery_calculation_snapshot,
            coupon_id,
            coupon_code,
            coupon_discount
        ) VALUES (
            v_order_id,
            v_product_id,
            v_variant_id,
            COALESCE(v_item->'product'->>'title', 'Product'),
            v_quantity,
            COALESCE((v_item->'product'->>'price')::NUMERIC, 0),
            COALESCE((v_item->'product'->>'isReturnable')::BOOLEAN, TRUE),
            0,
            (v_item->>'taxable_amount')::NUMERIC,
            (v_item->>'cgst')::NUMERIC,
            (v_item->>'sgst')::NUMERIC,
            (v_item->>'igst')::NUMERIC,
            v_item->>'hsn_code',
            (v_item->>'gst_rate')::NUMERIC,
            (v_item->>'total_amount')::NUMERIC,
            v_item->'variant_snapshot',
            COALESCE((v_item->>'delivery_charge')::NUMERIC, 0),
            COALESCE((v_item->>'delivery_gst')::NUMERIC, 0),
            v_item->'delivery_calculation_snapshot',
            (v_item->>'coupon_id')::UUID,
            v_item->>'coupon_code',
            COALESCE((v_item->>'coupon_discount')::NUMERIC, 0)
        );

        -- Decrease inventory
        IF v_variant_id IS NOT NULL THEN
            UPDATE product_variants 
            SET stock_quantity = stock_quantity - v_quantity, updated_at = NOW()
            WHERE id = v_variant_id;
        ELSE
            UPDATE products 
            SET inventory = inventory - v_quantity, updated_at = NOW()
            WHERE id = v_product_id;
        END IF;
    END LOOP;

    -- Link payment
    IF p_payment_id IS NOT NULL THEN
        UPDATE payments 
        SET order_id = v_order_id, updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    -- Create admin notifications
    INSERT INTO order_notifications (order_id, admin_id, status)
    SELECT v_order_id, p.id, 'unread'
    FROM profiles p
    INNER JOIN roles r ON p.role_id = r.id
    WHERE r.name = 'admin';

    -- Clear cart
    IF p_cart_id IS NOT NULL THEN
        DELETE FROM cart_items WHERE cart_id = p_cart_id;
        UPDATE carts SET applied_coupon_code = NULL, updated_at = NOW() WHERE id = p_cart_id;
    END IF;

    -- Return order
    SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;
    
    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'status', v_order_record.status,
        'total_amount', v_order_record.total_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

-- Migration: Fix Order Transaction Function (Use "updatedAt" camelCase)
-- Purpose: Update function to use the correct camelCase column name for timestamp

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
    v_quantity INT;
    v_current_stock INT;
BEGIN
    -- Generate order number (Format: ORDYYYYMMDDXXXX)
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

    -- 1. CREATE ORDER
    INSERT INTO orders (
        user_id,
        order_number,
        "customerName",
        "customerEmail",
        "customerPhone",
        shipping_address_id,
        billing_address_id,
        "shippingAddress",
        items,
        "totalAmount",
        subtotal,
        coupon_code,
        coupon_discount,
        delivery_charge,
        status,
        "paymentStatus",
        notes,
        "createdAt",
        "updatedAt"
    )
    SELECT
        p_user_id,
        v_order_number,
        p_order_data->>'customerName',
        p_order_data->>'customerEmail',
        p_order_data->>'customerPhone',
        (p_order_data->>'shipping_address_id')::UUID,
        (p_order_data->>'billing_address_id')::UUID,
        p_order_data->'shippingAddress',
        p_order_items,
        (p_order_data->>'totalAmount')::NUMERIC,
        (p_order_data->>'subtotal')::NUMERIC,
        p_order_data->>'coupon_code',
        (p_order_data->>'coupon_discount')::NUMERIC,
        (p_order_data->>'delivery_charge')::NUMERIC,
        COALESCE(p_order_data->>'status', 'confirmed'),
        COALESCE(p_order_data->>'paymentStatus', 'paid'),
        p_order_data->>'notes',
        NOW(),
        NOW()
    RETURNING id INTO v_order_id;

    -- 2. CREATE ORDER ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            title,
            quantity,
            price_per_unit,
            is_returnable,
            returned_quantity
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            COALESCE(v_item->'product'->>'title', 'Product'),
            (v_item->>'quantity')::INT,
            COALESCE((v_item->'product'->>'price')::NUMERIC, 0),
            COALESCE((v_item->'product'->>'isReturnable')::BOOLEAN, TRUE),
            0
        );
    END LOOP;

    -- 3. LINK PAYMENT TO ORDER (if payment_id provided)
    IF p_payment_id IS NOT NULL THEN
        UPDATE payments 
        SET order_id = v_order_id, updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    -- 4. CREATE ADMIN NOTIFICATIONS
    INSERT INTO order_notifications (order_id, admin_id, status)
    SELECT v_order_id, p.id, 'unread'
    FROM profiles p
    INNER JOIN roles r ON p.role_id = r.id
    WHERE r.name = 'admin';

    -- 5. DECREASE INVENTORY
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        
        -- Check stock availability
        SELECT inventory INTO v_current_stock FROM products WHERE id = v_product_id;
        
        IF v_current_stock IS NULL THEN
            RAISE EXCEPTION 'Product % not found', v_product_id;
        END IF;
        
        IF v_current_stock < v_quantity THEN
            RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', 
                v_product_id, v_current_stock, v_quantity;
        END IF;
        
        -- Fix: Use double quotes for "updatedAt" to preserve camelCase
        UPDATE products 
        SET inventory = inventory - v_quantity, "updatedAt" = NOW()
        WHERE id = v_product_id;
    END LOOP;

    -- 6. CLEAR CART
    IF p_cart_id IS NOT NULL THEN
        DELETE FROM cart_items WHERE cart_id = p_cart_id;
        UPDATE carts SET applied_coupon_code = NULL, updated_at = NOW() WHERE id = p_cart_id;
    END IF;

    -- Return created order
    SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;
    
    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'status', v_order_record.status,
        'totalAmount', v_order_record."totalAmount"
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction is automatically rolled back on exception
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

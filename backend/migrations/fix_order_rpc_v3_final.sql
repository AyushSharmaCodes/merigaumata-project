-- Migration: Fix Order Transaction RPC (V3 Final)
-- Purpose: Fix mismatch between JSON keys (snake_case from JS) and SQL extraction regarding customer_name.
-- Also ensure history is logged.

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
        payment_id,
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
        status,
        payment_status,
        notes,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        v_order_number,
        p_payment_id,
        p_order_data->>'customer_name',  -- FIX: Read snake_case key
        p_order_data->>'customer_email', -- FIX: Read snake_case key
        p_order_data->>'customer_phone', -- FIX: Read snake_case key
        (p_order_data->>'shipping_address_id')::UUID,
        (p_order_data->>'billing_address_id')::UUID,
        p_order_data->'shipping_address', -- FIX: Read snake_case key
        p_order_items,
        (p_order_data->>'total_amount')::NUMERIC, -- FIX: Read snake_case key
        (p_order_data->>'subtotal')::NUMERIC,
        p_order_data->>'coupon_code',
        (p_order_data->>'coupon_discount')::NUMERIC,
        (p_order_data->>'delivery_charge')::NUMERIC,
        COALESCE(p_order_data->>'status', 'pending'),
        COALESCE(p_order_data->>'payment_status', 'paid'), -- FIX: Read snake_case key
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

    -- 3. LOG INITIAL HISTORY
    INSERT INTO order_status_history (
        order_id,
        status,
        updated_by,
        notes,
        created_at,
        event_type,
        actor
    ) VALUES (
        v_order_id,
        COALESCE(p_order_data->>'status', 'pending'),
        p_user_id,
        'Order placed successfully. Awaiting confirmation.',
        NOW(),
        'ORDER_PLACED',
        'USER'
    );

    -- 4. LINK PAYMENT TO ORDER
    IF p_payment_id IS NOT NULL THEN
        UPDATE payments 
        SET order_id = v_order_id, updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    -- 5. CREATE ADMIN NOTIFICATIONS
    INSERT INTO order_notifications (order_id, admin_id, status)
    SELECT v_order_id, p.id, 'unread'
    FROM profiles p
    INNER JOIN roles r ON p.role_id = r.id
    WHERE r.name = 'admin';

    -- 6. DECREASE INVENTORY
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
        
        UPDATE products 
        SET inventory = inventory - v_quantity, updated_at = NOW()
        WHERE id = v_product_id;
    END LOOP;

    -- 7. CLEAR CART
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
        'totalAmount', v_order_record.total_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

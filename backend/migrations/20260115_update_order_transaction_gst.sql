-- Migration: Update Order Transaction Function for GST Support
-- Created: 2026-01-15
-- Description: Updates the transactional order creation to include tax snapshot fields

-- ============================================================================
-- UPDATE THE CREATE_ORDER_TRANSACTIONAL FUNCTION
-- ============================================================================

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
SET search_path = public
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_order_record RECORD;
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
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

    -- 1. CREATE ORDER (with tax summary columns)
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
        -- New tax summary columns
        total_taxable_amount,
        total_cgst,
        total_sgst,
        total_igst,
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
        COALESCE((p_order_data->>'coupon_discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0),
        COALESCE(p_order_data->>'status', 'confirmed'),
        COALESCE(p_order_data->>'paymentStatus', 'paid'),
        p_order_data->>'notes',
        -- Tax summary values
        COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_igst')::NUMERIC, 0),
        NOW(),
        NOW()
    RETURNING id INTO v_order_id;

    -- 2. CREATE ORDER ITEMS (with tax snapshot)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        INSERT INTO order_items (
            order_id,
            product_id,
            variant_id,
            title,
            quantity,
            price_per_unit,
            is_returnable,
            returned_quantity,
            -- New tax snapshot columns
            taxable_amount,
            cgst,
            sgst,
            igst,
            hsn_code,
            gst_rate,
            total_amount,
            variant_snapshot
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            NULLIF(v_item->>'variant_id', '')::UUID,
            COALESCE(v_item->'product'->>'title', 'Product'),
            (v_item->>'quantity')::INT,
            COALESCE((v_item->'product'->>'price')::NUMERIC, 0),
            COALESCE((v_item->'product'->>'isReturnable')::BOOLEAN, TRUE),
            0,
            -- Tax snapshot values
            NULLIF(v_item->>'taxable_amount', '')::NUMERIC,
            COALESCE((v_item->>'cgst')::NUMERIC, 0),
            COALESCE((v_item->>'sgst')::NUMERIC, 0),
            COALESCE((v_item->>'igst')::NUMERIC, 0),
            v_item->>'hsn_code',
            NULLIF(v_item->>'gst_rate', '')::NUMERIC,
            NULLIF(v_item->>'total_amount', '')::NUMERIC,
            v_item->'variant_snapshot'
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
    WHERE r.name IN ('admin', 'manager');

    -- 5. DECREASE INVENTORY (check variant stock if variant_id exists)
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        
        IF v_variant_id IS NOT NULL THEN
            -- Decrease variant stock
            SELECT stock_quantity INTO v_current_stock 
            FROM product_variants WHERE id = v_variant_id;
            
            IF v_current_stock IS NULL THEN
                RAISE EXCEPTION 'Variant % not found', v_variant_id;
            END IF;
            
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Insufficient stock for variant %. Available: %, Requested: %', 
                    v_variant_id, v_current_stock, v_quantity;
            END IF;
            
            UPDATE product_variants 
            SET stock_quantity = stock_quantity - v_quantity, updated_at = NOW()
            WHERE id = v_variant_id;
        ELSE
            -- Decrease product inventory (non-variant products)
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
        END IF;
    END LOOP;

    -- 6. CLEAR CART
    IF p_cart_id IS NOT NULL THEN
        DELETE FROM cart_items WHERE cart_id = p_cart_id;
        UPDATE carts SET applied_coupon_code = NULL, updated_at = NOW() WHERE id = p_cart_id;
    END IF;

    -- Return created order (include tax summary in response)
    SELECT * INTO v_order_record FROM orders WHERE id = v_order_id;
    
    RETURN jsonb_build_object(
        'id', v_order_id,
        'order_number', v_order_number,
        'status', v_order_record.status,
        'totalAmount', v_order_record."totalAmount",
        'total_cgst', v_order_record.total_cgst,
        'total_sgst', v_order_record.total_sgst,
        'total_igst', v_order_record.total_igst
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction is automatically rolled back on exception
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_order_transactional TO service_role;

COMMENT ON FUNCTION create_order_transactional IS 
'Atomically creates an order with items (including GST tax snapshot), payment link, notifications, inventory update, and cart clearing. Supports variant-level stock management. Rolls back all changes if any step fails.';

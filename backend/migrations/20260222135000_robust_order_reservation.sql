-- Migration: Robust Order Reservation Architecture
-- Created: 2026-02-22
-- Description: Moves order number reservation out of the 'orders' table into a dedicated 'order_reservations' table.

-- 1. Create the reservation table
CREATE TABLE IF NOT EXISTS order_reservations (
    order_number TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 hour')
);

-- Index for cleanup optimization
CREATE INDEX IF NOT EXISTS idx_order_reservations_expires_at ON order_reservations (expires_at);

-- 2. Update generate_next_order_number to use the new table
DROP FUNCTION IF EXISTS generate_next_order_number();

CREATE OR REPLACE FUNCTION generate_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_number TEXT;
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- We'll try to generate a unique order number up to 10 times to avoid collisions
    FOR i IN 1..10 LOOP
        -- Build the order number: MGM + YYYY + 8 random chars
        v_order_number := 'MGM' || TO_CHAR(NOW(), 'YYYY') || generate_random_alphanumeric(8);
        
        -- Check if it already exists in ACTUAL orders
        IF EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) THEN
            CONTINUE;
        END IF;

        BEGIN
            -- Reserve this number in the dedicated reservations table
            INSERT INTO order_reservations (order_number) VALUES (v_order_number);
            
            v_inserted := TRUE;
            EXIT; -- Break out of the loop
            
        EXCEPTION WHEN unique_violation THEN
            -- In the rare case of a collision in the reservations table, loop and try again
            CONTINUE;
        END;
    END LOOP;
    
    IF NOT v_inserted THEN
        RAISE EXCEPTION 'Failed to generate a unique order number after 10 attempts.';
    END IF;
    
    RETURN v_order_number;
END;
$$;

-- 3. Update create_order_transactional to handle reservations correctly
-- The hint says: DROP FUNCTION create_order_transactional(uuid,jsonb,jsonb,uuid,uuid,text,text)
DROP FUNCTION IF EXISTS create_order_transactional(uuid, jsonb, jsonb, uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION create_order_transactional(
    p_user_id UUID,
    p_order_items JSONB,
    p_order_data JSONB,
    p_payment_id UUID DEFAULT NULL,
    p_cart_id UUID DEFAULT NULL,
    p_coupon_code TEXT DEFAULT NULL,
    p_order_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_id UUID;
    v_order_number TEXT;
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_quantity INT;
    v_current_stock INT;
    v_product_title TEXT;
    v_variant_label TEXT;
    v_order_record RECORD;
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- Input Validation
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id cannot be null';
    END IF;

    IF jsonb_array_length(p_order_items) = 0 THEN
        RAISE EXCEPTION 'Order must contain at least one item';
    END IF;

    -- 1. RESOLVE ORDER NUMBER
    v_order_number := p_order_number;
    
    -- If no order number provided, generate one on the fly (legacy/fallback)
    IF v_order_number IS NULL THEN
        FOR i IN 1..10 LOOP
            v_order_number := 'MGM' || TO_CHAR(NOW(), 'YYYY') || generate_random_alphanumeric(8);
            IF NOT EXISTS (SELECT 1 FROM orders WHERE order_number = v_order_number) AND 
               NOT EXISTS (SELECT 1 FROM order_reservations WHERE order_number = v_order_number) THEN
                EXIT;
            END IF;
            IF i = 10 THEN RAISE EXCEPTION 'Failed to generate unique order number'; END IF;
        END LOOP;
    END IF;

    -- 2. INSERT ORDER (Always a new insert now, never an update of a placeholder)
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
        delivery_gst,
        status,
        payment_status,
        notes,
        is_delivery_refundable,
        delivery_tax_type,
        total_taxable_amount,
        total_cgst,
        total_sgst,
        total_igst,
        created_at,
        updated_at
    )
    SELECT
        p_user_id,
        v_order_number,
        p_payment_id,
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
        COALESCE((p_order_data->>'coupon_discount')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0),
        COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        COALESCE(p_order_data->>'status', 'pending'),
        COALESCE(p_order_data->>'payment_status', 'paid'),
        p_order_data->>'notes',
        COALESCE((p_order_data->>'is_delivery_refundable')::BOOLEAN, TRUE),
        COALESCE(p_order_data->>'delivery_tax_type', 'GST'),
        COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_igst')::NUMERIC, 0),
        NOW(),
        NOW()
    RETURNING id INTO v_order_id;

    -- 3. REMOVE RESERVATION (If it exists)
    DELETE FROM order_reservations WHERE order_number = v_order_number;

    -- 4. CREATE ORDER ITEMS
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
            coupon_discount
        ) VALUES (
            v_order_id,
            (v_item->>'product_id')::UUID,
            (v_item->>'variant_id')::UUID,
            COALESCE(v_item->'product'->>'title', 'Product'),
            (v_item->>'quantity')::INT,
            COALESCE((v_item->'product'->>'price')::NUMERIC, 0),
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
            (v_item->>'coupon_id')::UUID,
            v_item->>'coupon_code',
            COALESCE((v_item->>'coupon_discount')::NUMERIC, 0)
        );
    END LOOP;

    -- 5. LOG INITIAL HISTORY
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

    -- 6. LINK PAYMENT TO ORDER
    IF p_payment_id IS NOT NULL THEN
        UPDATE payments 
        SET order_id = v_order_id, updated_at = NOW()
        WHERE id = p_payment_id;
    END IF;

    -- 7. CREATE ADMIN NOTIFICATIONS
    INSERT INTO order_notifications (order_id, admin_id, status)
    SELECT v_order_id, p.id, 'unread'
    FROM profiles p
    INNER JOIN roles r ON p.role_id = r.id
    WHERE r.name = 'admin';

    -- 8. DECREASE INVENTORY
    FOR v_item IN 
        SELECT * FROM jsonb_array_elements(p_order_items) 
        ORDER BY (value->>'product_id'), (value->>'variant_id') NULLS FIRST
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        
        IF v_variant_id IS NOT NULL THEN
            SELECT pv.stock_quantity, p.title, pv.size_label
            INTO v_current_stock, v_product_title, v_variant_label
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id
            FOR UPDATE;
            
            IF v_current_stock IS NULL THEN
                RAISE EXCEPTION 'Variant % for product % not found', v_variant_id, v_product_id;
            END IF;
            
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Insufficient stock for % - %. Available: %, Requested: %', 
                    v_product_title, v_variant_label, v_current_stock, v_quantity;
            END IF;
            
            UPDATE product_variants 
            SET stock_quantity = stock_quantity - v_quantity, updated_at = NOW()
            WHERE id = v_variant_id;
            
            UPDATE products 
            SET inventory = inventory - v_quantity, updated_at = NOW()
            WHERE id = v_product_id;
        ELSE
            SELECT inventory, title INTO v_current_stock, v_product_title
            FROM products WHERE id = v_product_id FOR UPDATE;
            
            IF v_current_stock IS NULL THEN
                RAISE EXCEPTION 'Product % not found', v_product_id;
            END IF;
            
            IF v_current_stock < v_quantity THEN
                RAISE EXCEPTION 'Insufficient stock for product %. Available: %, Requested: %', 
                    v_product_title, v_current_stock, v_quantity;
            END IF;
            
            UPDATE products 
            SET inventory = inventory - v_quantity, updated_at = NOW()
            WHERE id = v_product_id;
        END IF;
    END LOOP;

    -- 9. CLEAR CART
    IF p_cart_id IS NOT NULL THEN
        DELETE FROM cart_items WHERE cart_id = p_cart_id;
        UPDATE carts SET applied_coupon_code = NULL, updated_at = NOW() WHERE id = p_cart_id;
    END IF;

    -- Final cleanup: Remove any existing PLACEHOLDER order with this number (legacy cleanup)
    DELETE FROM orders WHERE order_number = v_order_number AND customer_name = 'PLACEHOLDER';

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

-- 4. CLEANUP: Remove legacy placeholders from the orders table
DELETE FROM orders WHERE customer_name = 'PLACEHOLDER';

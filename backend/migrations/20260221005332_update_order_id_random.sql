-- Migration: Update process to generate random alphanumeric order numbers instead of sequential numbers
-- Format: MGM{YYYY}{8_random_alphanumeric_chars}
-- Created: 2026-02-21

CREATE OR REPLACE FUNCTION generate_random_alphanumeric(p_length INT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    v_result TEXT := '';
    i INT;
BEGIN
    FOR i IN 1..p_length LOOP
        v_result := v_result || substr(v_chars, floor(random() * length(v_chars) + 1)::integer, 1);
    END LOOP;
    RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION generate_next_order_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_number TEXT;
    v_inserted BOOLEAN := FALSE;
BEGIN
    -- We'll try to insert a unique order number up to 10 times to avoid collisions
    FOR i IN 1..10 LOOP
        -- Build the order number: MGM + YYYY + 8 random chars
        v_order_number := 'MGM' || TO_CHAR(NOW(), 'YYYY') || generate_random_alphanumeric(8);
        
        BEGIN
            -- CRITICAL: Reserve this number by creating a placeholder order
            -- This prevents race conditions where the same number could be generated twice
            -- The actual order will UPDATE this record via create_order_transactional
            INSERT INTO orders (
                order_number,
                user_id, 
                customer_name,
                customer_email,
                shipping_address,
                items,
                status,
                payment_status,
                total_amount,
                subtotal,
                delivery_charge,
                coupon_discount,
                total_taxable_amount,
                total_cgst,
                total_sgst,
                total_igst,
                created_at,
                updated_at
            ) VALUES (
                v_order_number,
                NULL, -- Will be updated when actual order is created
                'PLACEHOLDER', -- Temporary, will be updated
                'placeholder@temp.local', -- Temporary, will be updated
                '{"placeholder": true}'::jsonb, -- Temporary shipping address
                '[]'::jsonb, -- Temporary empty items array
                'pending',
                'pending',
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                0,
                NOW(),
                NOW()
            );
            
            -- If we got here, the insert was successful (no unique constraint violation)
            v_inserted := TRUE;
            EXIT; -- Break out of the loop
            
        EXCEPTION WHEN unique_violation THEN
            -- In the very rare case of a collision, we loop and try another random string
            CONTINUE;
        END;
    END LOOP;
    
    IF NOT v_inserted THEN
        RAISE EXCEPTION 'Failed to generate a unique order number after 10 attempts.';
    END IF;
    
    RETURN v_order_number;
END;
$$;

COMMENT ON FUNCTION generate_next_order_number() IS 
'Pre-generates and RESERVES a random alphanumeric order number (MGM{YYYY}{8_random_chars}). Replaces the sequential generator.';

-- Also need to update create_order_transactional to use random sequence if no order number is provided
-- Note: It shouldn't typically generate its own number because the frontend/backend gets it via generate_next_order_number
--       before payment, but for completeness, we make sure it creates a random one if needed.

-- Drop the old function first since we changed a parameter name/signature (or just to be safe)
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

    -- Generate order number or use provided (e.g., from Razorpay pre-generation)
    IF p_order_number IS NOT NULL THEN
        v_order_number := p_order_number;
    ELSE
        -- Try to generate a unique order number and INSERT instead of relying on external reservation
        FOR i IN 1..10 LOOP
            v_order_number := 'MGM' || TO_CHAR(NOW(), 'YYYY') || generate_random_alphanumeric(8);
            
            -- Can't just check existence, need to insert or rely on the later insert block crashing and retrying.
            -- To keep transaction block simple, if p_order_number is NOT provided, we simply try inserting later in the flow
            -- Since unique_violation aborts the whole transaction, we don't try loop inserts here, 
            -- but the frontend SHOULD always use generate_next_order_number first anyway.
            -- This logic generates a string, the insert happens below.
            EXIT; -- We just generate one for now and trust the frontend flow for actual uniqueness guarantees
        END LOOP;
    END IF;

    -- 1. CREATE/UPDATE ORDER
    IF p_order_number IS NOT NULL AND EXISTS(SELECT 1 FROM orders WHERE order_number = v_order_number AND customer_name = 'PLACEHOLDER') THEN
        -- UPDATE the placeholder order created by generate_next_order_number()
        UPDATE orders SET
            user_id = p_user_id,
            payment_id = p_payment_id,
            customer_name = p_order_data->>'customer_name',
            customer_email = p_order_data->>'customer_email',
            customer_phone = p_order_data->>'customer_phone',
            shipping_address_id = (p_order_data->>'shipping_address_id')::UUID,
            billing_address_id = (p_order_data->>'billing_address_id')::UUID,
            shipping_address = p_order_data->'shipping_address',
            items = p_order_items,
            total_amount = (p_order_data->>'total_amount')::NUMERIC,
            subtotal = (p_order_data->>'subtotal')::NUMERIC,
            coupon_code = p_order_data->>'coupon_code',
            coupon_discount = (p_order_data->>'coupon_discount')::NUMERIC,
            delivery_charge = (p_order_data->>'delivery_charge')::NUMERIC,
            status = COALESCE(p_order_data->>'status', 'pending'),
            payment_status = COALESCE(p_order_data->>'payment_status', 'paid'),
            notes = p_order_data->>'notes',
            is_delivery_refundable = COALESCE((p_order_data->>'is_delivery_refundable')::BOOLEAN, TRUE),
            delivery_tax_type = COALESCE(p_order_data->>'delivery_tax_type', 'GST'),
            total_taxable_amount = COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
            total_cgst = COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
            total_sgst = COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
            total_igst = COALESCE((p_order_data->>'total_igst')::NUMERIC, 0),
            updated_at = NOW()
        WHERE order_number = v_order_number
        RETURNING id INTO v_order_id;
    ELSE
        -- INSERT new order (legacy flow or if order number wasn't pre-generated)
        -- To be absolutely safe if calling without p_order_number, loop for unique violation isn't easily done in PlPgSQL
        -- without a nested BEGIN...EXCEPTION block wrapping the insert.
        -- We will wrap the INSERT in a loop in case of unique_violation.
        
        FOR i IN 1..10 LOOP
            BEGIN
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
                    (p_order_data->>'coupon_discount')::NUMERIC,
                    (p_order_data->>'delivery_charge')::NUMERIC,
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
                
                v_inserted := TRUE;
                EXIT; -- Success, exit loop
                
            EXCEPTION WHEN unique_violation THEN
                IF p_order_number IS NOT NULL THEN
                    -- If an explicit order number was passed and it collided (shouldn't happen since we check EXISTS above
                    -- unless it's a concurrent write, or it's not a placeholder but a real dup), we must fail.
                    RAISE EXCEPTION 'Order number % already exists', p_order_number;
                END IF;
                -- Else, generate a new one and try again
                v_order_number := 'MGM' || TO_CHAR(NOW(), 'YYYY') || generate_random_alphanumeric(8);
            END;
        END LOOP;
        
        IF NOT v_inserted THEN
             RAISE EXCEPTION 'Failed to generate unique order number after 10 retries';
        END IF;
    END IF;

    -- 2. CREATE ORDER ITEMS (Comprehensive version with Tax/Delivery)
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
            -- Tax Columns
            taxable_amount,
            cgst,
            sgst,
            igst,
            gst_rate,
            hsn_code,
            -- Delivery Columns
            delivery_charge,
            delivery_gst,
            total_amount,
            -- Snapshot Columns
            variant_snapshot,
            delivery_calculation_snapshot,
            -- Coupon Columns
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
            -- Tax Values
            COALESCE((v_item->>'taxable_amount')::NUMERIC, 0),
            COALESCE((v_item->>'cgst')::NUMERIC, 0),
            COALESCE((v_item->>'sgst')::NUMERIC, 0),
            COALESCE((v_item->>'igst')::NUMERIC, 0),
            COALESCE((v_item->>'gst_rate')::NUMERIC, 0),
            v_item->>'hsn_code',
            -- Delivery Values
            COALESCE((v_item->>'delivery_charge')::NUMERIC, 0),
            COALESCE((v_item->>'delivery_gst')::NUMERIC, 0),
            COALESCE((v_item->>'total_amount')::NUMERIC, 0),
            -- Snapshot Values
            v_item->'variant_snapshot',
            v_item->'delivery_calculation_snapshot',
            -- Coupon Values
            (v_item->>'coupon_id')::UUID,
            v_item->>'coupon_code',
            COALESCE((v_item->>'coupon_discount')::NUMERIC, 0)
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

    -- 6. DECREASE INVENTORY (Fixed Variant Stock Logic + Deadlock Prevention)
    FOR v_item IN 
        SELECT * FROM jsonb_array_elements(p_order_items) 
        ORDER BY (value->>'product_id'), (value->>'variant_id') NULLS FIRST
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_variant_id := (v_item->>'variant_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        
        IF v_variant_id IS NOT NULL THEN
            -- VARIANT MODE: Lock and update both parent and variant to ensure consistency
            SELECT pv.stock_quantity, p.title, pv.size_label
            INTO v_current_stock, v_product_title, v_variant_label
            FROM product_variants pv
            JOIN products p ON p.id = pv.product_id
            WHERE pv.id = v_variant_id
            FOR UPDATE; -- Locks both pv and p rows
            
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
            
            -- SYNC PARENT: Also decrease parent product total inventory to keep in sync
            UPDATE products 
            SET inventory = inventory - v_quantity, updated_at = NOW()
            WHERE id = v_product_id;
        ELSE
            -- PRODUCT MODE: Lock and update product inventory
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

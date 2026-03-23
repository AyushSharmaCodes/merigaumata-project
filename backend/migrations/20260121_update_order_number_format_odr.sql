-- Migration: Update Order Number Format for High Volume
-- Created: 2026-01-21
-- Description: Changes order number format to support lakhs of orders per day
-- Format: ODR{YYYYMMDD}{Sequential6Digits} e.g., ODR20260121000001
-- Supports up to 999,999 orders per day

CREATE OR REPLACE FUNCTION create_order_transactional(
    p_user_id UUID,
    p_order_data JSONB,
    p_order_items JSONB,
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
    v_order_record RECORD;
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_quantity INT;
    v_current_stock INT;
    v_product_title TEXT;
    v_variant_label TEXT;
BEGIN
    -- Generate or Use Provided Order Number
    IF p_order_number IS NOT NULL THEN
        v_order_number := p_order_number;
    ELSE
        -- Auto-generate order number (Format: ODRYYYYMMDD{6-digit-sequential})
        -- Changed from ORD to ODR
        -- Changed from 4-digit to 6-digit sequential (supports 999,999 orders/day)
        SELECT 'ODR' || TO_CHAR(NOW(), 'YYYYMMDD') || 
               LPAD((COALESCE(
                   (SELECT CAST(SUBSTRING(order_number FROM 12) AS INT) + 1
                    FROM orders 
                    WHERE order_number LIKE 'ODR' || TO_CHAR(NOW(), 'YYYYMMDD') || '%'
                    AND SUBSTRING(order_number FROM 12) ~ '^[0-9]+$' -- Only consider numeric suffixes
                    ORDER BY order_number DESC 
                    LIMIT 1), 
                   1
               ))::TEXT, 6, '0')  -- Changed from 4 to 6 digits
        INTO v_order_number;
    END IF;

    -- 1. CREATE OR UPDATE ORDER
    -- Check if this is a pre-generated order number (placeholder exists)
    SELECT id INTO v_order_id FROM orders WHERE order_number = v_order_number;
    
    IF v_order_id IS NOT NULL THEN
        -- UPDATE existing placeholder order
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
        WHERE order_number = v_order_number;
    ELSE
        -- INSERT new order (legacy flow or when no placeholder exists)
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

-- Add index for efficient order number lookups
CREATE INDEX IF NOT EXISTS idx_orders_number_date_desc ON orders(order_number DESC) 
WHERE order_number LIKE 'ODR%';

-- Add unique constraint to ensure no duplicate order numbers
-- Note: ALTER TABLE doesn't support IF NOT EXISTS, so we use DO block
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_order_number' AND conrelid = 'orders'::regclass
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT unique_order_number UNIQUE (order_number);
    END IF;
END $$;

COMMENT ON FUNCTION create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT) IS 
'Creates order with format ODR{YYYYMMDD}{6-digit-sequential}. Supports up to 999,999 orders per day.';

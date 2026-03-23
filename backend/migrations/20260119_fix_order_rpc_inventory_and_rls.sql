-- Migration: Fix Order Transaction Inventory and Enable RLS
-- Created: 2026-01-19
-- Description: 
-- 1. Updates create_order_transactional to handle product_variants stock decrement.
-- 2. Ensures all tax and delivery columns are correctly populated from JSON items.
-- 3. Redefines atomic inventory functions to ensure parent-variant synchronization.
-- 4. Enables RLS on orders table and adds policies for users and admins.

-- ============================================================================
-- 0. SELF-CONTAINED ROBUSTNESS: Ensure Extensions & Dependencies
-- ============================================================================

-- Ensure required extensions exist
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure order_notifications table exists
CREATE TABLE IF NOT EXISTS order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'unread',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_order_notifications_admin ON order_notifications(admin_id, status);

-- Ensure order_status_history has event_type and actor columns
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS event_type TEXT;
ALTER TABLE order_status_history ADD COLUMN IF NOT EXISTS actor TEXT DEFAULT 'SYSTEM';

-- Ensure orders table has refund metadata and payment linkage
ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_delivery_refundable BOOLEAN DEFAULT TRUE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_tax_type TEXT DEFAULT 'GST';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_id UUID;

-- Ensure order_items has all required columns for tax, delivery, and snapshots
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS cgst NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sgst NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS igst NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS gst_rate NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS hsn_code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_charge NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_gst NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS variant_snapshot JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS delivery_calculation_snapshot JSONB;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS coupon_id UUID;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC DEFAULT 0;

-- ============================================================================
-- 1. Redefine create_order_transactional with Variant Inventory Logic
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
            
            -- Also decrease parent product total inventory to keep in sync
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

-- ============================================================================
-- 2. Enable RLS and Policies for Orders table
-- ============================================================================

-- Enable RLS
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- 2.0 Cleanup Legacy Policies
DROP POLICY IF EXISTS "Enable all operations for orders" ON orders;

-- 2.1 User Policy: Can select their own orders
DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
CREATE POLICY "Users can view their own orders" ON orders
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2.2 Admin Policy: Can view all orders
DROP POLICY IF EXISTS "Admins can view all orders" ON orders;
CREATE POLICY "Admins can view all orders" ON orders
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('admin', 'manager')
    )
);

-- 2.3 User Policy: Can only insert via RPC (handled by SECURITY DEFINER)
-- We typically don't allow direct INSERT via PostgREST for orders to ensure transaction integrity.
-- However, for the RPC to work, it must be SECURITY DEFINER (which it is).

-- 2.4 Update/Delete: Restricted to Admin
DROP POLICY IF EXISTS "Admins can update orders" ON orders;
CREATE POLICY "Admins can update orders" ON orders
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('admin', 'manager')
    )
);

DROP POLICY IF EXISTS "Admins can delete orders" ON orders;
CREATE POLICY "Admins can delete orders" ON orders
FOR DELETE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('admin', 'manager')
    )
);

-- ============================================================================
-- 5. Redefine Atomic Inventory Functions with Parent Sync
-- ============================================================================

-- 5.1 Redefine decrement_inventory_atomic_v2
CREATE OR REPLACE FUNCTION decrement_inventory_atomic_v2(
    p_product_id UUID,
    p_quantity INT,
    p_variant_id UUID DEFAULT NULL,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_stock INT;
    v_new_stock INT;
    v_product_title TEXT;
    v_variant_label TEXT;
BEGIN
    IF p_variant_id IS NOT NULL THEN
        -- VARIANT MODE: Lock and update both parent and variant to ensure consistency
        SELECT pv.stock_quantity, p.title, pv.size_label
        INTO v_current_stock, v_product_title, v_variant_label
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = p_variant_id
        FOR UPDATE; -- Locks both pv and p rows
        
        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'VARIANT_NOT_FOUND',
                'message', format('Variant %s not found', p_variant_id),
                'traceId', p_trace_id
            );
        END IF;
        
        IF v_current_stock < p_quantity THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INSUFFICIENT_STOCK',
                'message', format('Insufficient stock for %s - %s. Available: %s, Requested: %s', 
                    v_product_title, v_variant_label, v_current_stock, p_quantity),
                'available', v_current_stock,
                'requested', p_quantity,
                'variantId', p_variant_id,
                'productTitle', v_product_title,
                'traceId', p_trace_id
            );
        END IF;
        
        v_new_stock := v_current_stock - p_quantity;
        
        UPDATE product_variants 
        SET stock_quantity = v_new_stock, updated_at = NOW()
        WHERE id = p_variant_id;
        
        -- SYNC PARENT: Also decrease parent product total inventory
        UPDATE products 
        SET inventory = inventory - p_quantity, updated_at = NOW()
        WHERE id = p_product_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'previousInventory', v_current_stock,
            'newInventory', v_new_stock,
            'decremented', p_quantity,
            'variantId', p_variant_id,
            'productId', p_product_id,
            'productTitle', v_product_title,
            'variantLabel', v_variant_label,
            'traceId', p_trace_id
        );
    ELSE
        -- PRODUCT MODE: Lock and update product inventory
        SELECT inventory, title 
        INTO v_current_stock, v_product_title
        FROM products 
        WHERE id = p_product_id
        FOR UPDATE;
        
        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'PRODUCT_NOT_FOUND',
                'message', format('Product %s not found', p_product_id),
                'traceId', p_trace_id
            );
        END IF;
        
        IF v_current_stock < p_quantity THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'INSUFFICIENT_STOCK',
                'message', format('Insufficient stock for %s. Available: %s, Requested: %s', 
                    v_product_title, v_current_stock, p_quantity),
                'available', v_current_stock,
                'requested', p_quantity,
                'productId', p_product_id,
                'productTitle', v_product_title,
                'traceId', p_trace_id
            );
        END IF;
        
        v_new_stock := v_current_stock - p_quantity;
        
        UPDATE products 
        SET inventory = v_new_stock, updated_at = NOW()
        WHERE id = p_product_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'previousInventory', v_current_stock,
            'newInventory', v_new_stock,
            'decremented', p_quantity,
            'productId', p_product_id,
            'productTitle', v_product_title,
            'traceId', p_trace_id
        );
    END IF;
END;
$$;

-- 5.2 Redefine increment_inventory_atomic_v2
CREATE OR REPLACE FUNCTION increment_inventory_atomic_v2(
    p_product_id UUID,
    p_quantity INT,
    p_variant_id UUID DEFAULT NULL,
    p_trace_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_current_stock INT;
    v_new_stock INT;
    v_product_title TEXT;
    v_variant_label TEXT;
BEGIN
    IF p_variant_id IS NOT NULL THEN
        -- VARIANT MODE: Lock and update both parent and variant to ensure consistency
        SELECT pv.stock_quantity, p.title, pv.size_label
        INTO v_current_stock, v_product_title, v_variant_label
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = p_variant_id
        FOR UPDATE; -- Locks both pv and p rows
        
        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'VARIANT_NOT_FOUND',
                'message', format('Variant %s not found', p_variant_id),
                'traceId', p_trace_id
            );
        END IF;
        
        v_new_stock := v_current_stock + p_quantity;
        
        UPDATE product_variants 
        SET stock_quantity = v_new_stock, updated_at = NOW()
        WHERE id = p_variant_id;
        
        -- SYNC PARENT: Also increase parent product total inventory
        UPDATE products 
        SET inventory = inventory + p_quantity, updated_at = NOW()
        WHERE id = p_product_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'previousInventory', v_current_stock,
            'newInventory', v_new_stock,
            'incremented', p_quantity,
            'variantId', p_variant_id,
            'productId', p_product_id,
            'productTitle', v_product_title,
            'variantLabel', v_variant_label,
            'traceId', p_trace_id
        );
    ELSE
        -- PRODUCT MODE: Lock and update product inventory
        SELECT inventory, title 
        INTO v_current_stock, v_product_title
        FROM products 
        WHERE id = p_product_id
        FOR UPDATE;
        
        IF v_current_stock IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'PRODUCT_NOT_FOUND',
                'message', format('Product %s not found', p_product_id),
                'traceId', p_trace_id
            );
        END IF;
        
        v_new_stock := v_current_stock + p_quantity;
        
        UPDATE products 
        SET inventory = v_new_stock, updated_at = NOW()
        WHERE id = p_product_id;
        
        RETURN jsonb_build_object(
            'success', true,
            'previousInventory', v_current_stock,
            'newInventory', v_new_stock,
            'incremented', p_quantity,
            'productId', p_product_id,
            'productTitle', v_product_title,
            'traceId', p_trace_id
        );
    END IF;
END;
$$;

-- ============================================================================
-- 3. RLS Policies for order_items
-- ============================================================================

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own order items" ON order_items;
CREATE POLICY "Users can view their own order items" ON order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins can view all order items" ON order_items;
CREATE POLICY "Admins can view all order items" ON order_items
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('admin', 'manager')
    )
);

-- ============================================================================
-- 4. RLS Policies for order_status_history
-- ============================================================================

ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own order history" ON order_status_history;
CREATE POLICY "Users can view their own order history" ON order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM orders o
        WHERE o.id = order_status_history.order_id
        AND o.user_id = auth.uid()
    )
);

DROP POLICY IF EXISTS "Admins can view all order history" ON order_status_history;
CREATE POLICY "Admins can view all order history" ON order_status_history
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() 
        AND r.name IN ('admin', 'manager')
    )
);

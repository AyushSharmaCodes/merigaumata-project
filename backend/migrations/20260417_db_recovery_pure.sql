-- Atomic Restoration to Master Branch State
-- Reverts all 2026-04-17 modifications

BEGIN;

-- 1. DROP DAILY TABLES & INDICES
DROP TABLE IF EXISTS public.qc_audits CASCADE;

DROP INDEX IF EXISTS public.idx_order_status_history_tracking;
DROP INDEX IF EXISTS public.idx_orders_previous_state;
DROP INDEX IF EXISTS public.idx_qc_one_per_item;
DROP INDEX IF EXISTS public.idx_qc_audits_return_id;
DROP INDEX IF EXISTS public.idx_qc_audits_order_id;
DROP INDEX IF EXISTS public.idx_qc_audits_status;

-- 2. ROLLBACK SCHEMA MODIFICATIONS
-- (Self-healing: Restore columns if they were already dropped by a previous failed run)
DO $$ 
BEGIN 
    -- order_status_history reconciliation
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_status_history' AND column_name = 'event_type') THEN
        ALTER TABLE public.order_status_history ADD COLUMN event_type TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_status_history' AND column_name = 'metadata') THEN
        ALTER TABLE public.order_status_history ADD COLUMN metadata JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- returns reconciliation (refund_breakdown is CRITICAL)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'refund_breakdown') THEN
        ALTER TABLE public.returns ADD COLUMN refund_breakdown JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- optional but safe return status columns
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'qc_status') THEN
        ALTER TABLE public.returns ADD COLUMN qc_status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'refund_status') THEN
        ALTER TABLE public.returns ADD COLUMN refund_status TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'returns' AND column_name = 'return_outcome') THEN
        ALTER TABLE public.returns ADD COLUMN return_outcome TEXT;
    END IF;

    -- return_items reconciliation (CRITICAL for Partial Returns)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'status') THEN
        ALTER TABLE public.return_items ADD COLUMN status TEXT DEFAULT 'requested';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'reason') THEN
        ALTER TABLE public.return_items ADD COLUMN reason TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'images') THEN
        ALTER TABLE public.return_items ADD COLUMN images TEXT[] DEFAULT '{}'::text[];
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'return_items' AND column_name = 'condition') THEN
        ALTER TABLE public.return_items ADD COLUMN condition TEXT;
    END IF;

    -- orders reconciliation (Tax snapshots required by RPC)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'delivery_gst') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_gst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_taxable_amount') THEN
        ALTER TABLE public.orders ADD COLUMN total_taxable_amount DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_cgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_cgst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_sgst') THEN
        ALTER TABLE public.orders ADD COLUMN total_sgst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'total_igst') THEN
        ALTER TABLE public.orders ADD COLUMN total_igst DECIMAL(10, 2) DEFAULT 0;
    END IF;

    -- order_items reconciliation (Variant and Tax snapshots)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_id') THEN
        ALTER TABLE public.order_items ADD COLUMN variant_id UUID REFERENCES public.product_variants(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'taxable_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN taxable_amount DECIMAL(10, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'cgst') THEN
        ALTER TABLE public.order_items ADD COLUMN cgst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'sgst') THEN
        ALTER TABLE public.order_items ADD COLUMN sgst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'igst') THEN
        ALTER TABLE public.order_items ADD COLUMN igst DECIMAL(10, 2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'hsn_code') THEN
        ALTER TABLE public.order_items ADD COLUMN hsn_code TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'gst_rate') THEN
        ALTER TABLE public.order_items ADD COLUMN gst_rate DECIMAL(10, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'total_amount') THEN
        ALTER TABLE public.order_items ADD COLUMN total_amount DECIMAL(10, 2);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'variant_snapshot') THEN
        ALTER TABLE public.order_items ADD COLUMN variant_snapshot JSONB DEFAULT '{}'::jsonb;
    END IF;

END $$;

-- Drop obsolete or experimental daily columns that are NOT used in services
ALTER TABLE public.returns 
    DROP COLUMN IF EXISTS version;

ALTER TABLE public.orders 
    DROP COLUMN IF EXISTS previous_state,
    DROP COLUMN IF EXISTS version;

-- These are now protected by the DO block above to ensure functional integrity
-- ALTER TABLE public.returns DROP COLUMN qc_status, refund_status, return_outcome;




ALTER TABLE public.profiles 
    DROP COLUMN IF EXISTS is_flagged,
    DROP COLUMN IF EXISTS flag_reason;

ALTER TABLE public.products 
    DROP COLUMN IF EXISTS weight_grams,
    DROP COLUMN IF EXISTS return_logistics_fee;

ALTER TABLE public.refunds 
    DROP CONSTRAINT IF EXISTS unique_refund_idempotency,
    DROP COLUMN IF EXISTS idempotency_key,
    DROP COLUMN IF EXISTS version;

ALTER TABLE public.payments 
    DROP COLUMN IF EXISTS version;

-- 3. RESTORE RPC: create_order_transactional
DROP FUNCTION IF EXISTS public.create_order_transactional(UUID, JSONB, JSONB, UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.create_order_transactional(
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
SET search_path = public
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
    IF p_order_number IS NOT NULL AND p_order_number <> '' THEN
        v_order_number := p_order_number;
    ELSE
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
    END IF;

    INSERT INTO orders (
        user_id, order_number, payment_id, customer_name, customer_email, customer_phone,
        shipping_address_id, billing_address_id, shipping_address, items, total_amount, subtotal,
        coupon_code, coupon_discount, delivery_charge, delivery_gst, status, payment_status, notes,
        total_taxable_amount, total_cgst, total_sgst, total_igst, created_at, updated_at
    )
    SELECT
        p_user_id, v_order_number, p_payment_id, p_order_data->>'customer_name',
        p_order_data->>'customer_email', p_order_data->>'customer_phone',
        (p_order_data->>'shipping_address_id')::UUID, (p_order_data->>'billing_address_id')::UUID,
        p_order_data->'shipping_address', p_order_items, (p_order_data->>'total_amount')::NUMERIC,
        (p_order_data->>'subtotal')::NUMERIC, p_coupon_code, (p_order_data->>'coupon_discount')::NUMERIC,
        COALESCE((p_order_data->>'delivery_charge')::NUMERIC, 0), COALESCE((p_order_data->>'delivery_gst')::NUMERIC, 0),
        COALESCE(p_order_data->>'status', 'pending'),
        COALESCE(p_order_data->>'payment_status', 'pending'), p_order_data->>'notes',
        COALESCE((p_order_data->>'total_taxable_amount')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_cgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_sgst')::NUMERIC, 0),
        COALESCE((p_order_data->>'total_igst')::NUMERIC, 0),
        NOW(), NOW()
    RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        INSERT INTO order_items (
            order_id, product_id, variant_id, title, quantity, price_per_unit, is_returnable, returned_quantity,
            taxable_amount, cgst, sgst, igst, hsn_code, gst_rate, total_amount, variant_snapshot
        ) VALUES (
            v_order_id, (v_item->>'product_id')::UUID, (v_item->>'variant_id')::UUID,
            COALESCE(v_item->'product'->>'title', v_item->>'title', 'Product'),
            (v_item->>'quantity')::INT,
            COALESCE((v_item->>'price_per_unit')::NUMERIC, (v_item->'product'->>'price')::NUMERIC, 0),
            COALESCE((v_item->>'is_returnable')::BOOLEAN, (v_item->'product'->>'isReturnable')::BOOLEAN, TRUE),
            0,
            (v_item->>'taxable_amount')::NUMERIC,
            COALESCE((v_item->>'cgst')::NUMERIC, 0),
            COALESCE((v_item->>'sgst')::NUMERIC, 0),
            COALESCE((v_item->>'igst')::NUMERIC, 0),
            v_item->>'hsn_code',
            (v_item->>'gst_rate')::NUMERIC,
            (v_item->>'total_amount')::NUMERIC,
            v_item->'variant_snapshot'
        );
    END LOOP;

    INSERT INTO order_status_history (order_id, status, updated_by, notes, created_at, event_type, actor)
    VALUES (v_order_id, COALESCE(p_order_data->>'status', 'pending'), p_user_id, 'Order created successfully', NOW(), 'ORDER_PLACED', 'USER');

    IF p_payment_id IS NOT NULL THEN
        UPDATE payments SET order_id = v_order_id, updated_at = NOW() WHERE id = p_payment_id;
    END IF;
    
    IF p_coupon_code IS NOT NULL THEN
        UPDATE coupons SET usage_count = COALESCE(usage_count, 0) + 1, updated_at = NOW() WHERE code = p_coupon_code;
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_order_items)
    LOOP
        v_product_id := (v_item->>'product_id')::UUID;
        v_quantity := (v_item->>'quantity')::INT;
        UPDATE products SET inventory = inventory - v_quantity, updated_at = NOW()
        WHERE id = v_product_id AND inventory >= v_quantity;
    END LOOP;

    IF p_cart_id IS NOT NULL THEN
        DELETE FROM cart_items WHERE cart_id = p_cart_id;
    END IF;

    SELECT status, total_amount, total_cgst, total_sgst, total_igst, total_taxable_amount 
    INTO v_order_record FROM orders WHERE id = v_order_id;
    
    RETURN jsonb_build_object(
        'id', v_order_id, 
        'order_number', v_order_number, 
        'status', v_order_record.status, 
        'total_amount', v_order_record.total_amount,
        'total_cgst', v_order_record.total_cgst,
        'total_sgst', v_order_record.total_sgst,
        'total_igst', v_order_record.total_igst,
        'total_taxable_amount', v_order_record.total_taxable_amount
    );


EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Order creation failed: %', SQLERRM;
END;
$$;

-- 4. RESTORE RPC: batch_decrement_inventory_atomic
DROP FUNCTION IF EXISTS public.batch_decrement_inventory_atomic(JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.batch_decrement_inventory_atomic(p_items JSONB, p_trace_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_qty INTEGER;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;

        IF v_variant_id IS NOT NULL THEN
            UPDATE public.product_variants 
            SET stock_quantity = stock_quantity - v_qty, updated_at = NOW()
            WHERE id = v_variant_id AND stock_quantity >= v_qty;
        ELSE
            UPDATE public.products 
            SET inventory = inventory - v_qty, updated_at = NOW()
            WHERE id = v_product_id AND inventory >= v_qty;
        END IF;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'trace_id', p_trace_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 4.1 RESTORE RPC: batch_increment_inventory_atomic
DROP FUNCTION IF EXISTS public.batch_increment_inventory_atomic(JSONB, TEXT);
CREATE OR REPLACE FUNCTION public.batch_increment_inventory_atomic(p_items JSONB, p_trace_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item JSONB;
    v_product_id UUID;
    v_variant_id UUID;
    v_qty INTEGER;
    v_count INTEGER := 0;
BEGIN
    FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
    LOOP
        v_qty := COALESCE((v_item->>'quantity')::INTEGER, 0);
        v_product_id := NULLIF(v_item->>'product_id', '')::UUID;
        v_variant_id := NULLIF(v_item->>'variant_id', '')::UUID;

        IF v_variant_id IS NOT NULL THEN
            UPDATE public.product_variants 
            SET stock_quantity = stock_quantity + v_qty, updated_at = NOW()
            WHERE id = v_variant_id;
        ELSE
            UPDATE public.products 
            SET inventory = inventory + v_qty, updated_at = NOW()
            WHERE id = v_product_id;
        END IF;
        v_count := v_count + 1;
    END LOOP;
    RETURN jsonb_build_object('success', true, 'itemCount', v_count, 'trace_id', p_trace_id);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- 5. RESTORE MASTER RLS POLICIES

-- 5.1 Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles p
        INNER JOIN roles r ON p.role_id = r.id
        WHERE p.id = auth.uid() AND r.name IN ('admin', 'manager')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.user_owns_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM orders
        WHERE id = order_uuid AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 5.2 Table Specific Policies

-- Orders
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON orders;
DROP POLICY IF EXISTS "Users view own orders" ON orders;
DROP POLICY IF EXISTS "Users can view own orders" ON orders;
DROP POLICY IF EXISTS "Enable all operations for orders" ON orders;
DROP POLICY IF EXISTS "Admins can modify orders" ON orders;

CREATE POLICY "service_role_all" ON orders FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own orders" ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin_or_manager());
CREATE POLICY "Admins can modify orders" ON orders FOR UPDATE USING (is_admin_or_manager());

-- Order Items
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON order_items;
DROP POLICY IF EXISTS "Users view own order items" ON order_items;
DROP POLICY IF EXISTS "Users can view own order items" ON order_items;

CREATE POLICY "service_role_all" ON order_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own order items" ON order_items FOR SELECT USING (user_owns_order(order_id) OR is_admin_or_manager());

-- Order Status History
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON order_status_history;
DROP POLICY IF EXISTS "Users view own order history" ON order_status_history;
DROP POLICY IF EXISTS "Users can view own order history" ON order_status_history;
DROP POLICY IF EXISTS "Service role can manage order history" ON order_status_history;
DROP POLICY IF EXISTS "Admins can manage order history" ON order_status_history;

CREATE POLICY "service_role_all" ON order_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own order history" ON order_status_history FOR SELECT USING (user_owns_order(order_id) OR is_admin_or_manager());

-- Payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON payments;
DROP POLICY IF EXISTS "Users view own payments" ON payments;
DROP POLICY IF EXISTS "Users can view own payments" ON payments;

CREATE POLICY "service_role_all" ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own payments" ON payments FOR SELECT USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM orders WHERE orders.payment_id = payments.id AND orders.user_id = auth.uid()) OR is_admin_or_manager());

-- Refunds
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON refunds;
DROP POLICY IF EXISTS "Users view own refunds" ON refunds;
DROP POLICY IF EXISTS "Service role can manage refunds" ON refunds;

CREATE POLICY "service_role_all" ON refunds FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users view own refunds" ON refunds FOR SELECT USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid()) OR is_admin_or_manager());

-- Returns
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON returns;
DROP POLICY IF EXISTS "Users manage own returns" ON returns;
DROP POLICY IF EXISTS "Users can create return requests" ON returns;
DROP POLICY IF EXISTS "Users can view own returns" ON returns;

CREATE POLICY "service_role_all" ON returns FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users manage own returns" ON returns FOR ALL USING (EXISTS (SELECT 1 FROM orders WHERE orders.id = returns.order_id AND orders.user_id = auth.uid()) OR is_admin_or_manager());

-- Return Items
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON return_items;
DROP POLICY IF EXISTS "Users manage own return items" ON return_items;
DROP POLICY IF EXISTS "Users can view own return items" ON return_items;
DROP POLICY IF EXISTS "Users can insert own return items" ON return_items;

CREATE POLICY "service_role_all" ON return_items FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Users manage own return items" ON return_items FOR ALL USING (EXISTS (SELECT 1 FROM returns r JOIN orders o ON r.order_id = o.id WHERE r.id = return_items.return_id AND o.user_id = auth.uid()) OR is_admin_or_manager());

-- Products & Variants
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all" ON products;
DROP POLICY IF EXISTS "service_role_all" ON product_variants;
DROP POLICY IF EXISTS "Enable all operations for products" ON products;
DROP POLICY IF EXISTS "Public can view products" ON products;
DROP POLICY IF EXISTS "Public can view variants" ON product_variants;

CREATE POLICY "service_role_all" ON products FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON product_variants FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Public can view products" ON products FOR SELECT USING (true);
CREATE POLICY "Public can view variants" ON product_variants FOR SELECT USING (true);


-- 5.3 Automated RLS Hardening (Loop)
DO $$
DECLARE
    tbl TEXT;
    tables_to_fix TEXT[] := ARRAY[
        'otp_codes', 'refresh_tokens', 'profiles', 'roles', 
        'reviews', 'testimonials', 'invoices',
        'events', 'event_registrations', 'event_refunds', 'event_cancellation_jobs',
        'blogs', 'faqs', 'policy_pages',
        'gallery_folders', 'gallery_items', 'gallery_videos', 'photos',
        'social_media', 'store_settings',
        'refund_audit_logs', 'order_notifications',
        'webhook_events', 'webhook_logs',
        'manager_permissions', 'phone_numbers'
    ];
    is_view BOOLEAN;
BEGIN
    FOREACH tbl IN ARRAY tables_to_fix
    LOOP
        SELECT EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND viewname = tbl) INTO is_view;
        IF is_view THEN CONTINUE; END IF;
        
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = tbl AND policyname = 'service_role_all') THEN
                EXECUTE format('CREATE POLICY service_role_all ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)', tbl);
            END IF;
        END IF;
    END LOOP;
END $$;

-- 5.1 RESTORE event_type CHECK CONSTRAINT
ALTER TABLE public.order_status_history 
DROP CONSTRAINT IF EXISTS order_status_history_event_type_check;

ALTER TABLE public.order_status_history
ADD CONSTRAINT order_status_history_event_type_check
CHECK (event_type IN (
    'ORDER_PLACED', 'ORDER_CONFIRMED', 'ORDER_PROCESSING', 'ORDER_PACKED', 'ORDER_SHIPPED',
    'OUT_FOR_DELIVERY', 'ORDER_DELIVERED', 'ORDER_CANCELLED', 'ORDER_RETURNED',
    'PARTIALLY_RETURNED', 'RETURN_REQUESTED', 'RETURN_APPROVED', 'RETURN_REJECTED',
    'RETURN_CANCELLED', 'RETURN_PICKED_UP', 'PICKUP_SCHEDULED', 'ITEM_RETURNED',
    'DELIVERY_UNSUCCESSFUL', 'REFUND_INITIATED', 'REFUND_COMPLETED', 'REFUND_PARTIAL',
    'REFUND_FAILED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PAYMENT_PENDING',
    'STATUS_CHANGE', 'MANUAL_UPDATE'
));

-- 6. RESTORE MASTER CONSTRAINTS
ALTER TABLE public.returns DROP CONSTRAINT IF EXISTS returns_status_check;
ALTER TABLE public.returns ADD CONSTRAINT returns_status_check 
CHECK (status IN ('requested', 'approved', 'pickup_scheduled', 'picked_up', 'item_returned', 'rejected', 'cancelled', 'completed'));

-- 6.1 return_items status check
ALTER TABLE public.return_items DROP CONSTRAINT IF EXISTS return_items_status_check;
ALTER TABLE public.return_items ADD CONSTRAINT return_items_status_check
CHECK (status IN ('requested', 'approved', 'rejected', 'picked_up', 'item_returned', 'cancelled'));


COMMIT;

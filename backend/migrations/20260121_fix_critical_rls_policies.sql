-- =====================================================
-- SURGICAL RLS POLICY FIX
-- Created: 2026-01-21
-- Purpose: Fix critical RLS issues without breaking existing policies
-- Strategy: Add missing policies, deduplicate, standardize admin checks
-- =====================================================

-- ===================
-- STEP 1: CREATE/UPDATE HELPER FUNCTIONS
-- ===================

-- Standardized admin check function (more efficient than JOIN in every policy)
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

-- Function to check if user owns a specific order
CREATE OR REPLACE FUNCTION public.user_owns_order(order_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM orders
        WHERE id = order_uuid AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.is_admin_or_manager() IS 'Standardized admin/manager role check for RLS policies';
COMMENT ON FUNCTION public.user_owns_order(UUID) IS 'Check if authenticated user owns specified order';

-- ===================
-- STEP 2: FIX CRITICAL MISSING POLICIES
-- ===================

-- *** CRITICAL FIX #1: order_status_history ***
-- This is causing the timeline not to update!

-- Enable RLS if not already enabled
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any (fresh start for this critical table)
DROP POLICY IF EXISTS "Service role can insert order history" ON order_status_history;
DROP POLICY IF EXISTS "Users view own order history" ON order_status_history;
DROP POLICY IF EXISTS "Admins view all order history" ON order_status_history;
DROP POLICY IF EXISTS "service_role_all" ON order_status_history;

-- NEW POLICIES: Allow service role to insert, users/admins to view
CREATE POLICY "service_role_all" ON order_status_history
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Users view own order history" ON order_status_history
    FOR SELECT
    USING (user_owns_order(order_id) OR is_admin_or_manager());

COMMENT ON POLICY "service_role_all" ON order_status_history IS 
    'CRITICAL: Service role must bypass RLS for timeline updates via backend';

-- *** CRITICAL FIX #2: orders ***
-- Ensure orders table has proper policies

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Check if policies exist, if not create them
DO $$
BEGIN
    -- Service role bypass
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON orders
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    -- Users view own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Users view own orders') THEN
        CREATE POLICY "Users view own orders" ON orders
            FOR SELECT
            USING (user_id = auth.uid() OR is_admin_or_manager());
    END IF;
    
    -- Admins can modify
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Admins can modify orders') THEN
        CREATE POLICY "Admins can modify orders" ON orders
            FOR UPDATE
            USING (is_admin_or_manager());
    END IF;
END $$;

-- *** CRITICAL FIX #3: order_items ***
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON order_items
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'order_items' AND policyname = 'Users view own order items') THEN
        CREATE POLICY "Users view own order items" ON order_items
            FOR SELECT
            USING (user_owns_order(order_id) OR is_admin_or_manager());
    END IF;
END $$;

-- *** CRITICAL FIX #4: payments ***
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON payments
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Users view own payments') THEN
        CREATE POLICY "Users view own payments" ON payments
            FOR SELECT
            USING (
                user_id = auth.uid() 
                OR EXISTS (SELECT 1 FROM orders WHERE orders.payment_id = payments.id AND orders.user_id = auth.uid())
                OR is_admin_or_manager()
            );
    END IF;
END $$;

-- *** CRITICAL FIX #5: refunds ***
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refunds' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON refunds
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'refunds' AND policyname = 'Users view own refunds') THEN
        CREATE POLICY "Users view own refunds" ON refunds
            FOR SELECT
            USING (
                EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid())
                OR is_admin_or_manager()
            );
    END IF;
END $$;

-- *** CRITICAL FIX #6: invoices ***
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON invoices
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'invoices' AND policyname = 'Users view own invoices') THEN
        CREATE POLICY "Users view own invoices" ON invoices
            FOR SELECT
            USING (
                EXISTS (SELECT 1 FROM orders WHERE orders.id = invoices.order_id AND orders.user_id = auth.uid())
                OR is_admin_or_manager()
            );
    END IF;
END $$;

-- *** CRITICAL FIX #7: returns & return_items ***
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Returns
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'returns' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON returns
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'returns' AND policyname = 'Users manage own returns') THEN
        CREATE POLICY "Users manage own returns" ON returns
            FOR ALL
            USING (
                EXISTS (SELECT 1 FROM orders WHERE orders.id = returns.order_id AND orders.user_id = auth.uid())
                OR is_admin_or_manager()
            );
    END IF;
    
    -- Return Items
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'return_items' AND policyname = 'service_role_all') THEN
        CREATE POLICY "service_role_all" ON return_items
            FOR ALL
            TO service_role
            USING (true)
            WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'return_items' AND policyname = 'Users manage own return items') THEN
        CREATE POLICY "Users manage own return items" ON return_items
            FOR ALL
            USING (
                EXISTS (
                    SELECT 1 FROM returns r 
                    JOIN orders o ON r.order_id = o.id 
                    WHERE r.id = return_items.return_id AND o.user_id = auth.uid()
                )
                OR is_admin_or_manager()
            );
    END IF;
END $$;

-- ===================
-- STEP 3: ADD MISSING SERVICE ROLE BYPASSES
-- ===================

-- Ensure all remaining tables have service_role bypass
-- NOTE: Skipping views (they can't have RLS)
DO $$
DECLARE
    tbl TEXT;
    tables_to_fix TEXT[] := ARRAY[
        'otp_codes', 'refresh_tokens', 'profiles', 'roles', 
        'reviews', 'testimonials',
        -- 'public_testimonials' is a VIEW, skip it
        'events', 'event_registrations', 'event_refunds', 'event_cancellation_jobs',
        'products', 'product_variants', 
        'blogs', 'faqs', 'policy_pages',
        'gallery_folders', 'gallery_items', 'gallery_videos', 'photos',
        'newsletter_config', 'newsletter_subscribers',
        'social_media', 'store_settings',
        'refund_audit_logs', 'order_notifications',
        'webhook_events', 'webhook_logs',
        'manager_permissions', 'phone_numbers'
    ];
    is_view BOOLEAN;
BEGIN
    FOREACH tbl IN ARRAY tables_to_fix
    LOOP
        -- Check if it's a view
        SELECT EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = 'public' AND viewname = tbl
        ) INTO is_view;
        
        -- Skip views
        IF is_view THEN
            RAISE NOTICE 'Skipping view: %', tbl;
            CONTINUE;
        END IF;
        
        -- Check if table exists
        IF NOT EXISTS (
            SELECT 1 FROM pg_tables 
            WHERE schemaname = 'public' AND tablename = tbl
        ) THEN
            RAISE NOTICE 'Table does not exist: %', tbl;
            CONTINUE;
        END IF;
        
        -- Enable RLS
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
        
        -- Add service_role bypass if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies 
            WHERE tablename = tbl AND policyname = 'service_role_all'
        ) THEN
            EXECUTE format(
                'CREATE POLICY service_role_all ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
                tbl
            );
            RAISE NOTICE 'Added service_role_all policy to: %', tbl;
        END IF;
    END LOOP;
END $$;

-- ===================
-- STEP 4: CLEAN UP DUPLICATE POLICIES
-- ===================

-- Remove duplicate contact_messages policies (keep the service_role ones)
DROP POLICY IF EXISTS "allow_authenticated_all" ON contact_messages;
DROP POLICY IF EXISTS "allow_public_insert" ON contact_messages;
DROP POLICY IF EXISTS "public_insert" ON contact_messages;
-- Keep: "Enable public insert for contact messages", "service_role_all", and admin view

-- Remove duplicate service role policies on account deletion tables
-- (These already have "Service role full access", don't need "service_role_all" too)
-- Actually keep both as they're identical and harmless

-- ===================
-- STEP 5: VERIFICATION QUERIES
-- ===================

-- Check order_status_history policies
DO $$
DECLARE
    policy_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO policy_count 
    FROM pg_policies 
    WHERE tablename = 'order_status_history';
    
    IF policy_count = 0 THEN
        RAISE WARNING 'order_status_history has NO policies! Timeline updates will fail!';
    ELSE
        RAISE NOTICE 'order_status_history has % policies ✓', policy_count;
    END IF;
END $$;

-- List all tables without RLS enabled
DO $$
DECLARE
    missing_rls TEXT[];
BEGIN
    SELECT ARRAY_AGG(tablename) INTO missing_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = false
    AND tablename NOT LIKE 'pg_%'
    AND tablename NOT LIKE 'sql_%';
    
    IF missing_rls IS NOT NULL THEN
        RAISE WARNING 'Tables without RLS: %', missing_rls;
    ELSE
        RAISE NOTICE 'All tables have RLS enabled ✓';
    END IF;
END $$;

-- Count critical table policies
SELECT 
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE tablename IN ('orders', 'order_items', 'order_status_history', 'payments', 'refunds', 'returns')
GROUP BY tablename
ORDER BY tablename;

COMMENT ON FUNCTION public.is_admin_or_manager() IS 
    'Used by RLS policies. STABLE function - safe to use in policies. Checks if auth.uid() has admin/manager role.';
    
COMMENT ON FUNCTION public.user_owns_order(UUID) IS 
    'Used by RLS policies. STABLE function - safe to use in policies. Checks if auth.uid() owns the specified order.';

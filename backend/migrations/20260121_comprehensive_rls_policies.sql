-- =====================================================
-- DEPRECATED RLS MIGRATION SAFETY SHIM
-- Created: 2026-01-21
-- Purpose: Preserve helper functions without mass-dropping all public policies.
--
-- Why this file is intentionally minimal:
-- The original version attempted to DROP every public-schema policy and then
-- recreate them in one pass. That is unsafe for production rollouts because:
-- 1. A syntax/runtime failure mid-migration can leave RLS partially removed.
-- 2. It overrode many table-specific policies defined in earlier migrations.
-- 3. It contained invalid policy syntax for INSERT rules.
--
-- Fresh deployments should rely on the table-specific migrations plus the
-- targeted repair migration in 20260121_comprehensive_rls_fix.sql.
-- =====================================================

-- Helper function to check if current user is admin or manager.
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.profiles p
        INNER JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = auth.uid()
          AND r.name IN ('admin', 'manager')
    );
END;
$$;

-- Helper function to check if the current user owns a specific order.
CREATE OR REPLACE FUNCTION public.user_owns_order(order_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.orders
        WHERE id = order_uuid
          AND user_id = auth.uid()
    );
END;
$$;

COMMENT ON FUNCTION public.is_admin_or_manager() IS
'Security-definer helper used by targeted RLS policies to detect admin or manager access.';

COMMENT ON FUNCTION public.user_owns_order(UUID) IS
'Security-definer helper used by targeted RLS policies to detect order ownership.';

DO $$
BEGIN
    RAISE NOTICE '20260121_comprehensive_rls_policies.sql is intentionally a no-op beyond helper functions. Use targeted RLS migrations for policy changes.';
END;
$$;

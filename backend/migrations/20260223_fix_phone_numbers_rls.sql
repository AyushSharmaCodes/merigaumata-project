-- =====================================================
-- FIX PHONE NUMBERS RLS POLICY
-- Created: 2026-02-23
-- Purpose: Correct the RLS policy for phone_numbers table which was referencing a non-existent column
-- =====================================================

-- 1. Drop the incorrect policy
DROP POLICY IF EXISTS "Users manage own phones" ON phone_numbers;

-- 2. Create the corrected policy using user_id which exists on the table
CREATE POLICY "Users manage own phones" ON phone_numbers 
FOR ALL 
USING (
    user_id = auth.uid() 
    OR is_admin_or_manager()
);

-- 3. Verify RLS is enabled (should already be, but safe to ensure)
ALTER TABLE phone_numbers ENABLE ROW LEVEL SECURITY;

COMMENT ON POLICY "Users manage own phones" ON phone_numbers IS 'Users can manage their own phone numbers, admins/managers view all';

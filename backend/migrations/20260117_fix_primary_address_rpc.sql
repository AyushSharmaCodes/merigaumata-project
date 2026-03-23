-- Fix Atomic Set Primary Address RPC
-- Removes type constraint to ensure ONLY ONE primary address per user globally
-- Also cleans up existing duplicate primaries
-- REMOVED: admin_alerts insert (table does not exist)

CREATE OR REPLACE FUNCTION set_primary_address(
    p_address_id UUID,
    p_user_id UUID,
    p_address_type VARCHAR,
    p_correlation_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- 1. Unset ALL existing primary addresses for this user (ignore type)
    UPDATE addresses 
    SET is_primary = false,
    updated_at = NOW()
    WHERE user_id = p_user_id 
      AND is_primary = true;

    -- 2. Set the specified address as primary
    UPDATE addresses 
    SET is_primary = true,
    updated_at = NOW()
    WHERE id = p_address_id 
      AND user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Cleanup: For users with multiple primary addresses, keep the most recently updated one
-- This logic resets all primaries to false, then sets the latest one to true for each user who has any primary address.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT user_id 
        FROM addresses 
        WHERE is_primary = true 
        GROUP BY user_id 
        HAVING COUNT(*) > 1
    LOOP
        -- Unset all for this user
        UPDATE addresses SET is_primary = false WHERE user_id = r.user_id;
        
        -- Set latest one as primary
        UPDATE addresses 
        SET is_primary = true 
        WHERE id = (
            SELECT id FROM addresses 
            WHERE user_id = r.user_id 
            ORDER BY updated_at DESC, created_at DESC 
            LIMIT 1
        );
    END LOOP;
END $$;

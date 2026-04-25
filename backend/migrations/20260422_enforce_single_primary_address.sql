-- Migration: Enforce Single Primary Address
-- Description: Cleans up duplicate primary addresses and adds a partial unique index to guarantee data integrity.

-- 1. Data Cleanup
-- For users with multiple primary addresses, we keep only the most recently updated one.
WITH RankedAddresses AS (
    SELECT 
        id,
        user_id,
        is_primary,
        updated_at,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY is_primary DESC, updated_at DESC) as rank
    FROM addresses
    WHERE is_primary = true
)
UPDATE addresses
SET is_primary = false,
    updated_at = NOW()
WHERE id IN (
    SELECT id 
    FROM RankedAddresses 
    WHERE rank > 1
);

-- 2. Add Partial Unique Index
-- This is the most reliable way in PostgreSQL to ensure only one record per user can have is_primary = true.
DROP INDEX IF EXISTS idx_single_primary_address;
CREATE UNIQUE INDEX idx_single_primary_address ON addresses (user_id) WHERE (is_primary = true);

-- 3. Harden Trigger Function
-- Simplify the trigger to just ensure that if a new address is set as primary, others are unset.
-- The unique index above will serve as the final safeguard.
CREATE OR REPLACE FUNCTION ensure_one_primary_address()
RETURNS TRIGGER AS $$
BEGIN
    -- If the new/updated address is primary, unset all other addresses for this user
    IF NEW.is_primary = true THEN
        UPDATE addresses 
        SET is_primary = false,
            updated_at = NOW()
        WHERE user_id = NEW.user_id 
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
          AND is_primary = true;
    END IF;

    -- If this is the user's ONLY address, force it to be primary
    IF NOT EXISTS (
        SELECT 1 FROM addresses 
        WHERE user_id = NEW.user_id 
          AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
    ) THEN
        NEW.is_primary = true;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-apply trigger to ensure it's active
DROP TRIGGER IF EXISTS ensure_primary_address_trigger ON addresses;
CREATE TRIGGER ensure_primary_address_trigger
    BEFORE INSERT OR UPDATE ON addresses
    FOR EACH ROW
    EXECUTE FUNCTION ensure_one_primary_address();

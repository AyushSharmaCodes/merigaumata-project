-- Atomic Set Primary Address RPC
-- Ensures only one primary address exists per user/type and logs the operation

CREATE OR REPLACE FUNCTION set_primary_address(
    p_address_id UUID,
    p_user_id UUID,
    p_address_type VARCHAR,
    p_correlation_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    -- 1. Unset any existing primary address for this user and type
    UPDATE addresses 
    SET is_primary = false,
        updated_at = NOW()
    WHERE user_id = p_user_id 
      AND type = p_address_type 
      AND is_primary = true;

    -- 2. Set the specified address as primary
    UPDATE addresses 
    SET is_primary = true,
        updated_at = NOW()
    WHERE id = p_address_id 
      AND user_id = p_user_id;

    -- 3. Trigger notification/alert (optional - using existing alert system if available)
    -- This is a placeholder for audit/alert logs if needed
    INSERT INTO admin_alerts (
        type,
        title,
        message,
        severity,
        metadata
    ) VALUES (
        'USER_ADDRESS_UPDATE',
        'Primary Address Changed',
        format('User %s set primary %s address to %s', p_user_id, p_address_type, p_address_id),
        'info',
        jsonb_build_object(
            'user_id', p_user_id,
            'address_id', p_address_id,
            'address_type', p_address_type,
            'correlation_id', p_correlation_id
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

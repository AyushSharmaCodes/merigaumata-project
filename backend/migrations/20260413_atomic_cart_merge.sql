-- 20260413_atomic_cart_merge.sql
-- Goal: Consolidate guest-to-user cart merging into a single transactional RPC.

CREATE OR REPLACE FUNCTION merge_guest_into_user_cart(
    p_user_id uuid,
    p_guest_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_cart_id uuid;
    v_guest_cart_id uuid;
    v_item RECORD;
BEGIN
    -- 1. Get or Create User Cart
    INSERT INTO carts (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_user_cart_id;

    -- 2. Find Guest Cart
    SELECT id INTO v_guest_cart_id FROM carts WHERE guest_id = p_guest_id LIMIT 1;

    -- 3. If no guest cart, just return current user cart
    IF v_guest_cart_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'merged', false, 'cart_id', v_user_cart_id);
    END IF;

    -- 4. Move items from guest cart to user cart
    FOR v_item IN SELECT product_id, variant_id, quantity FROM cart_items WHERE cart_id = v_guest_cart_id LOOP
        INSERT INTO cart_items (cart_id, product_id, variant_id, quantity)
        VALUES (v_user_cart_id, v_item.product_id, v_item.variant_id, v_item.quantity)
        ON CONFLICT (cart_id, product_id, COALESCE(variant_id, '00000000-0000-0000-0000-000000000000'::uuid)) 
        DO UPDATE SET 
            quantity = cart_items.quantity + EXCLUDED.quantity,
            updated_at = NOW();
    END LOOP;

    -- 5. Transfer Coupon if user cart doesn't have one
    UPDATE carts u
    SET applied_coupon_code = g.applied_coupon_code
    FROM carts g
    WHERE u.id = v_user_cart_id 
    AND g.id = v_guest_cart_id 
    AND u.applied_coupon_code IS NULL 
    AND g.applied_coupon_code IS NOT NULL;

    -- 6. Cleanup Guest Cart
    DELETE FROM cart_items WHERE cart_id = v_guest_cart_id;
    DELETE FROM carts WHERE id = v_guest_cart_id;

    RETURN jsonb_build_object('success', true, 'merged', true, 'cart_id', v_user_cart_id);
END;
$$;

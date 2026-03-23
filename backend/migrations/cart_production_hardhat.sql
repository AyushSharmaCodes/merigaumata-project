-- Migration: Production Cart Hardening (Atomic RPCs)
-- Purpose: Eliminate read-modify-write races by performing increments in the database.

-- 1. Helper to get or create cart ID
CREATE OR REPLACE FUNCTION get_or_create_cart(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
    v_cart_id UUID;
BEGIN
    INSERT INTO carts (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    SELECT id INTO v_cart_id FROM carts WHERE user_id = p_user_id;
    RETURN v_cart_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atomic Add to Cart (Increment)
CREATE OR REPLACE FUNCTION add_to_cart_atomic(
    p_user_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    -- Ensure cart exists
    v_cart_id := get_or_create_cart(p_user_id);
    
    -- Atomic Upsert with Increment
    INSERT INTO cart_items (cart_id, product_id, quantity)
    VALUES (v_cart_id, p_product_id, p_quantity)
    ON CONFLICT (cart_id, product_id)
    DO UPDATE SET 
        quantity = cart_items.quantity + EXCLUDED.quantity
    WHERE cart_items.cart_id = v_cart_id AND cart_items.product_id = p_product_id;

    -- Return full cart state for UI sync
    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(
            json_agg(
                json_build_object(
                    'id', ci.id,
                    'product_id', ci.product_id,
                    'quantity', ci.quantity,
                    'added_at', ci.added_at,
                    'products', p.*
                )
            ) FILTER (WHERE ci.id IS NOT NULL),
            '[]'
        )
    ) INTO v_result
    FROM carts c
    LEFT JOIN cart_items ci ON c.id = ci.cart_id
    LEFT JOIN products p ON ci.product_id = p.id
    WHERE c.id = v_cart_id
    GROUP BY c.id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atomic Update Cart Item (Exact Set)
CREATE OR REPLACE FUNCTION update_cart_item_atomic(
    p_user_id UUID,
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS JSON AS $$
DECLARE
    v_cart_id UUID;
    v_result JSON;
BEGIN
    -- Ensure cart exists
    v_cart_id := get_or_create_cart(p_user_id);
    
    IF p_quantity <= 0 THEN
        DELETE FROM cart_items 
        WHERE cart_id = v_cart_id AND product_id = p_product_id;
    ELSE
        INSERT INTO cart_items (cart_id, product_id, quantity)
        VALUES (v_cart_id, p_product_id, p_quantity)
        ON CONFLICT (cart_id, product_id)
        DO UPDATE SET 
            quantity = p_quantity;
    END IF;

    -- Return full cart state
    SELECT json_build_object(
        'id', c.id,
        'user_id', c.user_id,
        'cart_items', COALESCE(
            json_agg(
                json_build_object(
                    'id', ci.id,
                    'product_id', ci.product_id,
                    'quantity', ci.quantity,
                    'added_at', ci.added_at,
                    'products', p.*
                )
            ) FILTER (WHERE ci.id IS NOT NULL),
            '[]'
        )
    ) INTO v_result
    FROM carts c
    LEFT JOIN cart_items ci ON c.id = ci.cart_id
    LEFT JOIN products p ON ci.product_id = p.id
    WHERE c.id = v_cart_id
    GROUP BY c.id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migration: Variant-Aware Atomic Inventory Functions
-- Purpose: Update atomic inventory functions to support product variants
-- Created: 2026-01-16

-- ============================================================================
-- Function: decrement_inventory_atomic_v2
-- Purpose: Atomically decrease inventory for a product OR variant
-- If variant_id is provided, decrements variant.stock_quantity
-- Otherwise, decrements product.inventory
-- ============================================================================

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
        -- VARIANT MODE: Lock and update variant stock
        SELECT pv.stock_quantity, p.title, pv.size_label
        INTO v_current_stock, v_product_title, v_variant_label
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = p_variant_id
        FOR UPDATE OF pv;
        
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

-- ============================================================================
-- Function: increment_inventory_atomic_v2
-- Purpose: Atomically increase inventory for a product OR variant (for restores/returns)
-- ============================================================================

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
        -- VARIANT MODE: Lock and update variant stock
        SELECT pv.stock_quantity, p.title, pv.size_label
        INTO v_current_stock, v_product_title, v_variant_label
        FROM product_variants pv
        JOIN products p ON p.id = pv.product_id
        WHERE pv.id = p_variant_id
        FOR UPDATE OF pv;
        
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION decrement_inventory_atomic_v2 TO service_role;
GRANT EXECUTE ON FUNCTION increment_inventory_atomic_v2 TO service_role;

COMMENT ON FUNCTION decrement_inventory_atomic_v2 IS 
'Variant-aware atomic inventory decrement. If variant_id is provided, decrements variant.stock_quantity, else decrements product.inventory.';

COMMENT ON FUNCTION increment_inventory_atomic_v2 IS 
'Variant-aware atomic inventory increment for restores/returns. If variant_id is provided, increments variant.stock_quantity, else increments product.inventory.';

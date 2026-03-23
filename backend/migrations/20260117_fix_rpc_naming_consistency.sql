-- Migration: Fix RPC Naming Consistency and Return Policy CRUD
-- Created: 2026-01-17

-- ============================================================================
-- 1. CREATE PRODUCT WITH VARIANTS (Fixed Naming)
-- ============================================================================

CREATE OR REPLACE FUNCTION create_product_with_variants(
    p_product_data JSONB,
    p_variants JSONB[]
)
RETURNS JSONB AS $$
DECLARE
    v_product_id UUID;
    v_variant JSONB;
    v_variant_ids UUID[] := '{}';
    v_variant_id UUID;
    v_has_default BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Validate at least one variant
    IF array_length(p_variants, 1) IS NULL OR array_length(p_variants, 1) = 0 THEN
        RAISE EXCEPTION 'At least one variant is required';
    END IF;
    
    -- Check if any variant is marked as default
    FOR i IN 1..array_length(p_variants, 1) LOOP
        IF (p_variants[i]->>'is_default')::boolean = true THEN
            v_has_default := true;
            EXIT;
        END IF;
    END LOOP;
    
    -- If no default specified, first variant becomes default
    IF NOT v_has_default THEN
        p_variants[1] := p_variants[1] || '{"is_default": true}'::jsonb;
    END IF;
    
    -- Create the product
    INSERT INTO products (
        title,
        description,
        price,
        mrp,
        images,
        category,
        inventory,
        tags,
        benefits,
        is_returnable,
        return_days,
        delivery_charge,
        default_hsn_code,
        default_gst_rate,
        default_tax_applicable,
        default_price_includes_tax,
        created_at
    ) VALUES (
        p_product_data->>'title',
        p_product_data->>'description',
        COALESCE((p_product_data->>'price')::decimal, 0),
        COALESCE((p_product_data->>'mrp')::decimal, 0),
        COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'images')),
            '{}'::text[]
        ),
        p_product_data->>'category',
        COALESCE((p_product_data->>'inventory')::integer, 0),
        COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'tags')),
            '{}'::text[]
        ),
        COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'benefits')),
            '{}'::text[]
        ),
        COALESCE(
            (p_product_data->>'is_returnable')::boolean, 
            (p_product_data->>'isReturnable')::boolean, 
            true
        ),
        COALESCE(
            (p_product_data->>'return_days')::integer, 
            (p_product_data->>'returnDays')::integer, 
            3
        ),
        COALESCE(
            (p_product_data->>'delivery_charge')::decimal, 
            (p_product_data->>'deliveryCharge')::decimal, 
            0
        ),
        p_product_data->>'default_hsn_code',
        COALESCE((p_product_data->>'default_gst_rate')::decimal, 0),
        COALESCE((p_product_data->>'default_tax_applicable')::boolean, true),
        COALESCE((p_product_data->>'default_price_includes_tax')::boolean, true),
        COALESCE(
            (p_product_data->>'created_at')::timestamptz, 
            (p_product_data->>'createdAt')::timestamptz, 
            NOW()
        )
    )
    RETURNING id INTO v_product_id;
    
    -- Create variants
    FOREACH v_variant IN ARRAY p_variants LOOP
        INSERT INTO product_variants (
            product_id,
            size_label,
            size_value,
            unit,
            mrp,
            selling_price,
            stock_quantity,
            variant_image_url,
            is_default,
            delivery_charge,
            hsn_code,
            gst_rate,
            tax_applicable,
            price_includes_tax
        ) VALUES (
            v_product_id,
            v_variant->>'size_label',
            COALESCE((v_variant->>'size_value')::decimal, 0),
            COALESCE(v_variant->>'unit', 'kg'),
            COALESCE((v_variant->>'mrp')::decimal, 0),
            COALESCE((v_variant->>'selling_price')::decimal, 0),
            COALESCE((v_variant->>'stock_quantity')::integer, 0),
            v_variant->>'variant_image_url',
            COALESCE((v_variant->>'is_default')::boolean, false),
            COALESCE(
              (v_variant->>'delivery_charge')::decimal,
              (v_variant->>'deliveryCharge')::decimal
            ),
            v_variant->>'hsn_code',
            COALESCE((v_variant->>'gst_rate')::decimal, 0),
            COALESCE((v_variant->>'tax_applicable')::boolean, true),
            COALESCE((v_variant->>'price_includes_tax')::boolean, true)
        )
        RETURNING id INTO v_variant_id;
        
        v_variant_ids := array_append(v_variant_ids, v_variant_id);
    END LOOP;
    
    -- Build result
    SELECT jsonb_build_object(
        'id', v_product_id,
        'variant_ids', to_jsonb(v_variant_ids),
        'success', true
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================================================
-- 2. UPDATE PRODUCT WITH VARIANTS (Fixed Naming)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_product_with_variants(
    p_product_id UUID,
    p_product_data JSONB,
    p_variants JSONB[]
)
RETURNS JSONB AS $$
DECLARE
    v_variant JSONB;
    v_variant_id UUID;
    v_ids_to_keep UUID[] := '{}';
    v_updated_variant_ids UUID[] := '{}';
    v_new_variant_ids UUID[] := '{}';
    v_result JSONB;
BEGIN
    -- Verify product exists
    IF NOT EXISTS (SELECT 1 FROM products WHERE id = p_product_id) THEN
        RAISE EXCEPTION 'Product not found: %', p_product_id;
    END IF;
    
    -- Update product basic info
    UPDATE products SET
        title = COALESCE(p_product_data->>'title', title),
        description = COALESCE(p_product_data->>'description', description),
        price = COALESCE((p_product_data->>'price')::decimal, price),
        mrp = COALESCE((p_product_data->>'mrp')::decimal, mrp),
        images = CASE 
            WHEN p_product_data ? 'images' THEN 
                ARRAY(SELECT jsonb_array_elements_text(p_product_data->'images'))
            ELSE images 
        END,
        category = COALESCE(p_product_data->>'category', category),
        inventory = COALESCE((p_product_data->>'inventory')::integer, inventory),
        tags = CASE 
            WHEN p_product_data ? 'tags' THEN 
                ARRAY(SELECT jsonb_array_elements_text(p_product_data->'tags'))
            ELSE tags 
        END,
        benefits = CASE 
            WHEN p_product_data ? 'benefits' THEN 
                ARRAY(SELECT jsonb_array_elements_text(p_product_data->'benefits'))
            ELSE benefits 
        END,
        is_returnable = COALESCE(
            (p_product_data->>'is_returnable')::boolean, 
            (p_product_data->>'isReturnable')::boolean, 
            is_returnable
        ),
        return_days = COALESCE(
            (p_product_data->>'return_days')::integer, 
            (p_product_data->>'returnDays')::integer, 
            return_days
        ),
        delivery_charge = COALESCE(
            (p_product_data->>'delivery_charge')::decimal, 
            (p_product_data->>'deliveryCharge')::decimal, 
            delivery_charge
        ),
        default_hsn_code = COALESCE(p_product_data->>'default_hsn_code', default_hsn_code),
        default_gst_rate = COALESCE((p_product_data->>'default_gst_rate')::decimal, default_gst_rate),
        default_tax_applicable = COALESCE((p_product_data->>'default_tax_applicable')::boolean, default_tax_applicable),
        default_price_includes_tax = COALESCE((p_product_data->>'default_price_includes_tax')::boolean, default_price_includes_tax)
    WHERE id = p_product_id;
    
    -- 1. Identify IDs to keep and delete orphans 
    IF p_variants IS NOT NULL AND array_length(p_variants, 1) > 0 THEN
        FOR i IN 1..array_length(p_variants, 1) LOOP
            IF p_variants[i] ? 'id' AND p_variants[i]->>'id' != '' THEN
                v_ids_to_keep := array_append(v_ids_to_keep, (p_variants[i]->>'id')::uuid);
            END IF;
        END LOOP;
    END IF;

    DELETE FROM product_variants 
    WHERE product_id = p_product_id 
      AND id != ALL(v_ids_to_keep);
    
    -- 2. Process each variant
    IF p_variants IS NOT NULL AND array_length(p_variants, 1) > 0 THEN
        FOREACH v_variant IN ARRAY p_variants LOOP
            IF v_variant ? 'id' AND v_variant->>'id' != '' THEN
                v_variant_id := (v_variant->>'id')::uuid;
                
                -- Update existing variant
                UPDATE product_variants SET
                    size_label = COALESCE(v_variant->>'size_label', size_label),
                    size_value = COALESCE((v_variant->>'size_value')::decimal, size_value),
                    unit = COALESCE(v_variant->>'unit', unit),
                    mrp = COALESCE((v_variant->>'mrp')::decimal, mrp),
                    selling_price = COALESCE((v_variant->>'selling_price')::decimal, selling_price),
                    stock_quantity = COALESCE((v_variant->>'stock_quantity')::integer, stock_quantity),
                    variant_image_url = CASE 
                        WHEN v_variant ? 'variant_image_url' THEN v_variant->>'variant_image_url'
                        ELSE variant_image_url
                    END,
                    is_default = COALESCE((v_variant->>'is_default')::boolean, is_default),
                    delivery_charge = CASE 
                        WHEN v_variant ? 'delivery_charge' THEN (v_variant->>'delivery_charge')::decimal 
                        WHEN v_variant ? 'deliveryCharge' THEN (v_variant->>'deliveryCharge')::decimal
                        ELSE delivery_charge 
                    END,
                    hsn_code = COALESCE(v_variant->>'hsn_code', hsn_code),
                    gst_rate = COALESCE((v_variant->>'gst_rate')::decimal, gst_rate),
                    tax_applicable = COALESCE((v_variant->>'tax_applicable')::boolean, tax_applicable),
                    price_includes_tax = COALESCE((v_variant->>'price_includes_tax')::boolean, price_includes_tax),
                    updated_at = NOW()
                WHERE id = v_variant_id;
                
                v_updated_variant_ids := array_append(v_updated_variant_ids, v_variant_id);
            ELSE
                -- Create new variant
                INSERT INTO product_variants (
                    product_id,
                    size_label,
                    size_value,
                    unit,
                    mrp,
                    selling_price,
                    stock_quantity,
                    variant_image_url,
                    is_default,
                    delivery_charge,
                    hsn_code,
                    gst_rate,
                    tax_applicable,
                    price_includes_tax
                ) VALUES (
                    p_product_id,
                    v_variant->>'size_label',
                    COALESCE((v_variant->>'size_value')::decimal, 0),
                    COALESCE(v_variant->>'unit', 'kg'),
                    COALESCE((v_variant->>'mrp')::decimal, 0),
                    COALESCE((v_variant->>'selling_price')::decimal, 0),
                    COALESCE((v_variant->>'stock_quantity')::integer, 0),
                    v_variant->>'variant_image_url',
                    COALESCE((v_variant->>'is_default')::boolean, false),
                    COALESCE(
                      (v_variant->>'delivery_charge')::decimal,
                      (v_variant->>'deliveryCharge')::decimal
                    ),
                    v_variant->>'hsn_code',
                    COALESCE((v_variant->>'gst_rate')::decimal, 0),
                    COALESCE((v_variant->>'tax_applicable')::boolean, true),
                    COALESCE((v_variant->>'price_includes_tax')::boolean, true)
                )
                RETURNING id INTO v_variant_id;
                
                v_new_variant_ids := array_append(v_new_variant_ids, v_variant_id);
            END IF;
        END LOOP;
    END IF;
    
    -- Build result
    SELECT jsonb_build_object(
        'id', p_product_id,
        'updated_variants', to_jsonb(v_updated_variant_ids),
        'new_variants', to_jsonb(v_new_variant_ids),
        'success', true
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

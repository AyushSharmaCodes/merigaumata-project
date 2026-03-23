-- Migration: Add Variant Size Label I18n Support
-- Created: 2026-02-16
-- Description: Adds size_label_i18n column to product_variants and updates RPCs

-- ============================================================================
-- 1. ADD COLUMN to product_variants
-- ============================================================================

DO $$
BEGIN
    -- Add size_label_i18n if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'product_variants' AND column_name = 'size_label_i18n'
    ) THEN
        ALTER TABLE product_variants ADD COLUMN size_label_i18n JSONB DEFAULT '{}'::jsonb;
        COMMENT ON COLUMN product_variants.size_label_i18n IS 'Localized variant size labels';
    END IF;
END $$;

-- ============================================================================
-- 2. UPDATE RPCs to handle new field
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
        default_hsn_code,
        default_gst_rate,
        default_tax_applicable,
        default_price_includes_tax,
        created_at,
        title_i18n,
        description_i18n,
        benefits_i18n,
        tags_i18n
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
        COALESCE((p_product_data->>'isReturnable')::boolean, (p_product_data->>'is_returnable')::boolean, true),
        COALESCE((p_product_data->>'returnDays')::integer, (p_product_data->>'return_days')::integer, 3),
        p_product_data->>'default_hsn_code',
        COALESCE((p_product_data->>'default_gst_rate')::decimal, 0),
        COALESCE((p_product_data->>'default_tax_applicable')::boolean, true),
        COALESCE((p_product_data->>'default_price_includes_tax')::boolean, true),
        COALESCE((p_product_data->>'createdAt')::timestamptz, (p_product_data->>'created_at')::timestamptz, NOW()),
        COALESCE(p_product_data->'title_i18n', jsonb_build_object('en', p_product_data->>'title')),
        COALESCE(p_product_data->'description_i18n', jsonb_build_object('en', p_product_data->>'description')),
        COALESCE(p_product_data->'benefits_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'tags_i18n', '{}'::jsonb)
    )
    RETURNING id INTO v_product_id;
    
    -- Insert variants
    FOR v_variant IN SELECT * FROM jsonb_array_elements(to_jsonb(p_variants)) LOOP
        INSERT INTO product_variants (
            product_id,
            size_label,
            size_label_i18n, -- ADDED
            size_value,
            unit,
            mrp,
            selling_price,
            stock_quantity,
            variant_image_url,
            is_default,
            description,
            description_i18n,
            hsn_code,
            gst_rate,
            tax_applicable,
            price_includes_tax
        ) VALUES (
            v_product_id,
            v_variant->>'size_label',
            COALESCE(v_variant->'size_label_i18n', jsonb_build_object('en', v_variant->>'size_label')), -- ADDED
            (v_variant->>'size_value')::decimal,
            v_variant->>'unit',
            (v_variant->>'mrp')::decimal,
            (v_variant->>'selling_price')::decimal,
            (v_variant->>'stock_quantity')::integer,
            v_variant->>'variant_image_url',
            (v_variant->>'is_default')::boolean,
            v_variant->>'description',
            COALESCE(v_variant->'description_i18n', '{}'::jsonb),
            v_variant->>'hsn_code',
            (v_variant->>'gst_rate')::decimal,
            (v_variant->>'tax_applicable')::boolean,
            (v_variant->>'price_includes_tax')::boolean
        )
        RETURNING id INTO v_variant_id;
        v_variant_ids := array_append(v_variant_ids, v_variant_id);
    END LOOP;
    
    -- Prepare result
    v_result := jsonb_build_object(
        'product_id', v_product_id,
        'variant_ids', v_variant_ids
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_product_with_variants(
    p_product_data JSONB,
    p_variants JSONB[]
)
RETURNS JSONB AS $$
DECLARE
    v_product_id UUID := (p_product_data->>'id')::uuid;
    v_variant JSONB;
    v_variant_id UUID;
    v_existing_variant_ids UUID[];
    v_new_variant_ids UUID[];
    v_has_default BOOLEAN := false;
    v_result JSONB;
BEGIN
    -- Validate product ID
    IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'Product ID is required for update';
    END IF;

    -- Check if any variant is marked as default
    FOR v_variant IN SELECT * FROM jsonb_array_elements(to_jsonb(p_variants)) LOOP
        IF (v_variant->>'is_default')::boolean = true THEN
            v_has_default := true;
            EXIT;
        END IF;
    END LOOP;

    -- If no default specified, first variant becomes default
    IF NOT v_has_default AND array_length(p_variants, 1) > 0 THEN
        p_variants[1] := p_variants[1] || '{"is_default": true}'::jsonb;
    END IF;

    -- Update the product
    UPDATE products
    SET
        title = p_product_data->>'title',
        description = p_product_data->>'description',
        price = COALESCE((p_product_data->>'price')::decimal, 0),
        mrp = COALESCE((p_product_data->>'mrp')::decimal, 0),
        images = COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'images')),
            '{}'::text[]
        ),
        category = p_product_data->>'category',
        inventory = COALESCE((p_product_data->>'inventory')::integer, 0),
        tags = COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'tags')),
            '{}'::text[]
        ),
        benefits = COALESCE(
            ARRAY(SELECT jsonb_array_elements_text(p_product_data->'benefits')),
            '{}'::text[]
        ),
        is_returnable = COALESCE((p_product_data->>'isReturnable')::boolean, (p_product_data->>'is_returnable')::boolean, true),
        return_days = COALESCE((p_product_data->>'returnDays')::integer, (p_product_data->>'return_days')::integer, 3),
        is_new = COALESCE((p_product_data->>'isNew')::boolean, (p_product_data->>'is_new')::boolean, false),
        variant_mode = p_product_data->>'variant_mode',
        default_hsn_code = p_product_data->>'default_hsn_code',
        default_gst_rate = COALESCE((p_product_data->>'default_gst_rate')::decimal, 0),
        default_tax_applicable = COALESCE((p_product_data->>'default_tax_applicable')::boolean, true),
        default_price_includes_tax = COALESCE((p_product_data->>'default_price_includes_tax')::boolean, true),
        title_i18n = COALESCE(p_product_data->'title_i18n', title_i18n),
        description_i18n = COALESCE(p_product_data->'description_i18n', description_i18n),
        benefits_i18n = COALESCE(p_product_data->'benefits_i18n', benefits_i18n),
        tags_i18n = COALESCE(p_product_data->'tags_i18n', tags_i18n),
        updated_at = NOW()
    WHERE id = v_product_id;

    -- Get existing variant IDs
    SELECT array_agg(id) INTO v_existing_variant_ids FROM product_variants WHERE product_id = v_product_id;

    -- Update existing variants and insert new ones
    FOR v_variant IN SELECT * FROM jsonb_array_elements(to_jsonb(p_variants)) LOOP
        v_variant_id := (v_variant->>'id')::uuid;

        IF v_variant_id IS NOT NULL AND v_variant_id = ANY(v_existing_variant_ids) THEN
            -- Update existing variant
            UPDATE product_variants
            SET
                size_label = v_variant->>'size_label',
                size_label_i18n = COALESCE(v_variant->'size_label_i18n', size_label_i18n), -- ADDED
                size_value = (v_variant->>'size_value')::decimal,
                unit = v_variant->>'unit',
                mrp = (v_variant->>'mrp')::decimal,
                selling_price = (v_variant->>'selling_price')::decimal,
                stock_quantity = (v_variant->>'stock_quantity')::integer,
                variant_image_url = v_variant->>'variant_image_url',
                is_default = (v_variant->>'is_default')::boolean,
                description = v_variant->>'description',
                description_i18n = COALESCE(v_variant->'description_i18n', description_i18n),
                hsn_code = v_variant->>'hsn_code',
                gst_rate = (v_variant->>'gst_rate')::decimal,
                tax_applicable = (v_variant->>'tax_applicable')::boolean,
                price_includes_tax = (v_variant->>'price_includes_tax')::boolean,
                updated_at = NOW()
            WHERE id = v_variant_id;
            
            -- Remove from list of existing IDs to track which ones are new
            v_existing_variant_ids := array_remove(v_existing_variant_ids, v_variant_id);
        ELSE
            -- Insert new variant
            INSERT INTO product_variants (
                product_id,
                size_label,
                size_label_i18n, -- ADDED
                size_value,
                unit,
                mrp,
                selling_price,
                stock_quantity,
                variant_image_url,
                is_default,
                description,
                description_i18n,
                hsn_code,
                gst_rate,
                tax_applicable,
                price_includes_tax
            ) VALUES (
                v_product_id,
                v_variant->>'size_label',
                COALESCE(v_variant->'size_label_i18n', jsonb_build_object('en', v_variant->>'size_label')), -- ADDED
                (v_variant->>'size_value')::decimal,
                v_variant->>'unit',
                (v_variant->>'mrp')::decimal,
                (v_variant->>'selling_price')::decimal,
                (v_variant->>'stock_quantity')::integer,
                v_variant->>'variant_image_url',
                (v_variant->>'is_default')::boolean,
                v_variant->>'description',
                COALESCE(v_variant->'description_i18n', '{}'::jsonb),
                v_variant->>'hsn_code',
                (v_variant->>'gst_rate')::decimal,
                (v_variant->>'tax_applicable')::boolean,
                (v_variant->>'price_includes_tax')::boolean
            )
            RETURNING id INTO v_variant_id;
            v_new_variant_ids := array_append(v_new_variant_ids, v_variant_id);
        END IF;
    END LOOP;

    -- Delete variants that were removed from the payload
    IF array_length(v_existing_variant_ids, 1) > 0 THEN
        DELETE FROM product_variants WHERE id = ANY(v_existing_variant_ids);
    END IF;
    
    -- Prepare result
    v_result := jsonb_build_object(
        'product_id', v_product_id,
        'updated_variants', p_variants,
        'new_variant_ids', v_new_variant_ids
    );
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

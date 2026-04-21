CREATE OR REPLACE FUNCTION public.create_product_with_variants(
    p_product_data JSONB,
    p_variants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_product_id UUID;
    v_variant JSONB;
    v_variant_ids UUID[] := '{}';
    v_variant_id UUID;
BEGIN
    INSERT INTO public.products (
        title, description, price, mrp, images, category, category_id, tags,
        inventory, benefits, is_returnable, return_days, is_new, rating,
        title_i18n, description_i18n, tags_i18n, benefits_i18n,
        default_hsn_code, default_gst_rate, default_tax_applicable, default_price_includes_tax
    ) VALUES (
        COALESCE(p_product_data->>'title', ''),
        COALESCE(p_product_data->>'description', ''),
        COALESCE((p_product_data->>'price')::NUMERIC, 0),
        NULLIF(p_product_data->>'mrp', '')::NUMERIC,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'images', '[]'::jsonb))), '{}'),
        p_product_data->>'category',
        NULLIF(p_product_data->>'category_id', '')::UUID,
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'tags', '[]'::jsonb))), '{}'),
        COALESCE((p_product_data->>'inventory')::INTEGER, 0),
        COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(p_product_data->'benefits', '[]'::jsonb))), '{}'),
        COALESCE((p_product_data->>'is_returnable')::BOOLEAN, true),
        COALESCE((p_product_data->>'return_days')::INTEGER, 3),
        COALESCE((p_product_data->>'is_new')::BOOLEAN, false),
        COALESCE((p_product_data->>'rating')::NUMERIC, 0),
        COALESCE(p_product_data->'title_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'description_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'tags_i18n', '{}'::jsonb),
        COALESCE(p_product_data->'benefits_i18n', '{}'::jsonb),
        p_product_data->>'default_hsn_code',
        COALESCE((p_product_data->>'default_gst_rate')::NUMERIC, 0),
        COALESCE((p_product_data->>'default_tax_applicable')::BOOLEAN, false),
        COALESCE((p_product_data->>'default_price_includes_tax')::BOOLEAN, false)
    )
    RETURNING id INTO v_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        INSERT INTO public.product_variants (
            product_id, size_label, size_label_i18n, description, description_i18n,
            variant_image_url, sku, price, mrp, stock_quantity, is_default, is_active
        ) VALUES (
            v_product_id,
            v_variant->>'size_label',
            COALESCE(v_variant->'size_label_i18n', '{}'::jsonb),
            v_variant->>'description',
            COALESCE(v_variant->'description_i18n', '{}'::jsonb),
            v_variant->>'variant_image_url',
            v_variant->>'sku',
            COALESCE((v_variant->>'price')::NUMERIC, 0),
            NULLIF(v_variant->>'mrp', '')::NUMERIC,
            COALESCE((v_variant->>'stock_quantity')::INTEGER, 0),
            COALESCE((v_variant->>'is_default')::BOOLEAN, false),
            COALESCE((v_variant->>'is_active')::BOOLEAN, true)
        )
        RETURNING id INTO v_variant_id;
        v_variant_ids := array_append(v_variant_ids, v_variant_id);
    END LOOP;

    RETURN jsonb_build_object('id', v_product_id, 'variant_ids', v_variant_ids);
END;

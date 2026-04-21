CREATE OR REPLACE FUNCTION public.update_product_with_variants(
    p_product_id UUID,
    p_product_data JSONB,
    p_variants JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
    v_variant JSONB;
    v_created UUID[] := '{}';
    v_updated UUID[] := '{}';
    v_variant_id UUID;
BEGIN
    UPDATE public.products
    SET
        title = COALESCE(p_product_data->>'title', title),
        description = COALESCE(p_product_data->>'description', description),
        price = COALESCE(NULLIF(p_product_data->>'price', '')::NUMERIC, price),
        mrp = COALESCE(NULLIF(p_product_data->>'mrp', '')::NUMERIC, mrp),
        category = COALESCE(p_product_data->>'category', category),
        category_id = COALESCE(NULLIF(p_product_data->>'category_id', '')::UUID, category_id),
        title_i18n = COALESCE(p_product_data->'title_i18n', title_i18n),
        description_i18n = COALESCE(p_product_data->'description_i18n', description_i18n),
        tags_i18n = COALESCE(p_product_data->'tags_i18n', tags_i18n),
        benefits_i18n = COALESCE(p_product_data->'benefits_i18n', benefits_i18n),
        default_hsn_code = COALESCE(p_product_data->>'default_hsn_code', default_hsn_code),
        default_gst_rate = COALESCE((p_product_data->>'default_gst_rate')::NUMERIC, default_gst_rate),
        default_tax_applicable = COALESCE((p_product_data->>'default_tax_applicable')::BOOLEAN, default_tax_applicable),
        default_price_includes_tax = COALESCE((p_product_data->>'default_price_includes_tax')::BOOLEAN, default_price_includes_tax),
        updated_at = NOW()
    WHERE id = p_product_id;

    FOR v_variant IN SELECT * FROM jsonb_array_elements(COALESCE(p_variants, '[]'::jsonb))
    LOOP
        IF NULLIF(v_variant->>'id', '') IS NOT NULL THEN
            UPDATE public.product_variants
            SET
                size_label = COALESCE(v_variant->>'size_label', size_label),
                size_label_i18n = COALESCE(v_variant->'size_label_i18n', size_label_i18n),
                description = COALESCE(v_variant->>'description', description),
                description_i18n = COALESCE(v_variant->'description_i18n', description_i18n),
                variant_image_url = COALESCE(v_variant->>'variant_image_url', variant_image_url),
                sku = COALESCE(v_variant->>'sku', sku),
                price = COALESCE(NULLIF(v_variant->>'price', '')::NUMERIC, price),
                mrp = COALESCE(NULLIF(v_variant->>'mrp', '')::NUMERIC, mrp),
                stock_quantity = COALESCE(NULLIF(v_variant->>'stock_quantity', '')::INTEGER, stock_quantity),
                is_default = COALESCE((v_variant->>'is_default')::BOOLEAN, is_default),
                is_active = COALESCE((v_variant->>'is_active')::BOOLEAN, is_active),
                updated_at = NOW()
            WHERE id = (v_variant->>'id')::UUID
            RETURNING id INTO v_variant_id;
            v_updated := array_append(v_updated, v_variant_id);
        ELSE
            INSERT INTO public.product_variants (
                product_id, size_label, size_label_i18n, description, description_i18n,
                variant_image_url, sku, price, mrp, stock_quantity, is_default, is_active
            ) VALUES (
                p_product_id,
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
            v_created := array_append(v_created, v_variant_id);
        END IF;
    END LOOP;

    RETURN jsonb_build_object('id', p_product_id, 'new_variants', v_created, 'updated_variants', v_updated);
END;

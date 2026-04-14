-- High-Performance Pagination RPCs
-- Date: 2026-04-13
-- Purpose: Reduce bandwidth by optimizing images and offloading sorting/pagination to the DB

--------------------------------------------------------------------------------
-- 1. Optimized Product Pagination (v3)
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_products_paginated_v3(int, int, text, text, text, text);
CREATE OR REPLACE FUNCTION get_products_paginated_v3(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 10,
    p_search text DEFAULT '',
    p_category text DEFAULT 'all',
    p_sort_by text DEFAULT 'newest',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Fetch Total Count
    SELECT count(*) INTO v_total
    FROM public.products
    WHERE (p_category = 'all' OR category_id::text = p_category OR category = p_category)
    AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%');

    -- Fetch Data
    WITH result_set AS (
        SELECT 
            p.id, p.price, p.mrp, p.inventory, p.rating, p."ratingCount", p."reviewCount", p.created_at,
            p.is_new, p.tags, p.variant_mode, p.is_returnable, p.return_days,
            p.category, p.category_id, p.images,
            p.default_hsn_code, p.default_gst_rate, p.default_tax_applicable, p.default_price_includes_tax,
            COALESCE(p.title_i18n->>p_lang, p.title) as title,
            p.title_i18n,
            COALESCE(p.description_i18n->>p_lang, p.description) as description,
            p.description_i18n,
            p.tags_i18n,
            p.benefits,
            p.benefits_i18n,
            -- Image Optimization: Still provide primary_image for convenience
            -- Normalization: Replace legacy bucket paths on the fly
            REPLACE(REPLACE(REPLACE(COALESCE(p.images[1], ''), '/product_images/', '/product-media/'), '/images/products/', '/product-media/'), '/images/', '/product-media/') as primary_image,
            (
                SELECT jsonb_agg(
                    REPLACE(REPLACE(REPLACE(img, '/product_images/', '/product-media/'), '/images/products/', '/product-media/'), '/images/', '/product-media/')
                ) 
                FROM unnest(p.images) img
            ) as normalized_images,
            (SELECT jsonb_agg(v.*) FROM public.product_variants v WHERE v.product_id = p.id) as variants
        FROM public.products p
        WHERE (p_category = 'all' OR category_id::text = p_category OR category = p_category)
        AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        ORDER BY 
            CASE WHEN p_sort_by = 'priceLowHigh' THEN price END ASC,
            CASE WHEN p_sort_by = 'priceHighLow' THEN price END DESC,
            CASE WHEN p_sort_by = 'reviewCount' THEN "reviewCount" END DESC,
            CASE WHEN p_sort_by = 'newest' THEN created_at END DESC NULLS LAST
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'products', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--------------------------------------------------------------------------------
-- 2. Optimized Blog Pagination
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_blogs_paginated(int, int, text, text);
CREATE OR REPLACE FUNCTION get_blogs_paginated(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 10,
    p_search text DEFAULT '',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_limit;

    SELECT count(*) INTO v_total FROM blogs WHERE published = true 
    AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR content ILIKE '%' || p_search || '%');

    WITH result_set AS (
        SELECT 
            id, 
            REPLACE(REPLACE(image, '/blog_images/', '/blog-media/'), '/blogs/', '/blog-media/') as image, 
            created_at, blog_code as slug,
            COALESCE(author_i18n->>p_lang, author) as author,
            date,
            COALESCE(tags_i18n->p_lang, to_jsonb(tags)) as tags,
            COALESCE(title_i18n->>p_lang, title) as title,
            COALESCE(excerpt_i18n->>p_lang, excerpt) as excerpt
        FROM blogs
        WHERE published = true
        AND (p_search = '' OR title ILIKE '%' || p_search || '%' OR content ILIKE '%' || p_search || '%')
        ORDER BY date DESC, created_at DESC
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'blogs', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_products_paginated_v3(int, int, text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_blogs_paginated(int, int, text, text) TO anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 3. Optimized Event Pagination
--------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS get_events_paginated(int, int, text, text, text);
CREATE OR REPLACE FUNCTION get_events_paginated(
    p_page int DEFAULT 1,
    p_limit int DEFAULT 10,
    p_search text DEFAULT '',
    p_status text DEFAULT 'all',
    p_lang text DEFAULT 'en'
)
RETURNS jsonb AS $$
DECLARE
    v_offset int;
    v_data jsonb;
    v_total bigint;
    v_now timestamp with time zone := NOW();
BEGIN
    v_offset := (p_page - 1) * p_limit;

    -- Fetch Total Count
    SELECT count(*) INTO v_total
    FROM public.events
    WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
    AND (
        p_status = 'all' OR
        (p_status = 'upcoming' AND start_date > v_now) OR
        (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
        (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
    );

    -- Fetch Data
    WITH result_set AS (
        SELECT 
            e.id, 
            REPLACE(REPLACE(e.image, '/event_images/', '/event-media/'), '/events/', '/event-media/') as image, 
            e.start_date, e.end_date, e.location, e.registrations, e.event_code as slug,
            COALESCE(e.title_i18n->>p_lang, e.title) as title,
            COALESCE(e.description_i18n->>p_lang, e.description) as description,
            (SELECT jsonb_build_object('name', COALESCE(c.name_i18n->>p_lang, c.name)) FROM categories c WHERE c.name = e.category AND c.type = 'event' LIMIT 1) as category_data
        FROM public.events e
        WHERE (p_search = '' OR title ILIKE '%' || p_search || '%' OR description ILIKE '%' || p_search || '%')
        AND (
            p_status = 'all' OR
            (p_status = 'upcoming' AND start_date > v_now) OR
            (p_status = 'completed' AND (end_date < v_now OR (end_date IS NULL AND start_date < v_now))) OR
            (p_status = 'ongoing' AND start_date <= v_now AND (end_date >= v_now OR end_date IS NULL))
        )
        ORDER BY start_date ASC
        LIMIT p_limit OFFSET v_offset
    )
    SELECT jsonb_agg(to_jsonb(r.*)) INTO v_data FROM result_set r;

    RETURN jsonb_build_object(
        'events', COALESCE(v_data, '[]'::jsonb),
        'total', v_total,
        'page', p_page,
        'limit', p_limit,
        'totalPages', CEIL(v_total::float / p_limit)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_events_paginated(int, int, text, text, text) TO anon, authenticated, service_role;

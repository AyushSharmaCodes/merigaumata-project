-- Update get_public_homepage_content to include ratings and review counts
CREATE OR REPLACE FUNCTION public.get_public_homepage_content(
    p_now TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_products JSONB := '[]'::jsonb;
    v_events JSONB := '[]'::jsonb;
    v_blogs JSONB := '[]'::jsonb;
    v_testimonials JSONB := '[]'::jsonb;
    v_gallery_items JSONB := '[]'::jsonb;
    v_carousel_slides JSONB := '[]'::jsonb;
BEGIN
    IF to_regclass('public.products') IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(product_row ORDER BY product_row.created_at DESC), '[]'::jsonb)
        INTO v_products
        FROM (
            SELECT
                p.id,
                p.title,
                p.title_i18n,
                p.description,
                p.description_i18n,
                p.price,
                p.mrp,
                p.images,
                p.category,
                p.category_id,
                p.inventory,
                p.created_at,
                p.rating,
                p."ratingCount",
                p."reviewCount",
                p.is_new,
                p.tags,
                p.tags_i18n,
                p.benefits,
                p.benefits_i18n,
                p.variant_mode,
                p.default_hsn_code,
                p.default_gst_rate,
                p.default_tax_applicable,
                p.default_price_includes_tax,
                p.is_returnable,
                p.return_days,
                COALESCE(variants.variants, '[]'::jsonb) AS variants,
                CASE
                    WHEN c.id IS NULL THEN NULL
                    ELSE jsonb_build_object(
                        'id', c.id,
                        'name', c.name,
                        'name_i18n', c.name_i18n
                    )
                END AS category_data
            FROM public.products p
            LEFT JOIN public.categories c
                ON c.id = p.category_id
            LEFT JOIN LATERAL (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', pv.id,
                        'size_label', pv.size_label,
                        'size_label_i18n', pv.size_label_i18n,
                        'description', pv.description,
                        'description_i18n', pv.description_i18n,
                        'mrp', pv.mrp,
                        'selling_price', pv.selling_price,
                        'stock_quantity', pv.stock_quantity,
                        'variant_image_url', pv.variant_image_url,
                        'is_default', pv.is_default,
                        'hsn_code', pv.hsn_code,
                        'gst_rate', pv.gst_rate
                    )
                    ORDER BY pv.is_default DESC, pv.created_at ASC, pv.id
                ) AS variants
                FROM public.product_variants pv
                WHERE pv.product_id = p.id
            ) variants ON TRUE
            ORDER BY p.created_at DESC
            LIMIT 10
        ) AS product_row;
    END IF;

    IF to_regclass('public.events') IS NOT NULL THEN
        SELECT COALESCE(
            jsonb_agg(events_union.event_row ORDER BY events_union.sort_bucket ASC, events_union.start_date ASC),
            '[]'::jsonb
        )
        INTO v_events
        FROM (
            SELECT * FROM (
                SELECT
                    0 AS sort_bucket,
                    to_jsonb(e.*) AS event_row,
                    e.start_date
                FROM public.events e
                WHERE e.start_date <= p_now
                  AND (e.end_date >= p_now OR e.end_date IS NULL)
                ORDER BY e.start_date ASC
                LIMIT 5
            ) AS ongoing_events
            UNION ALL
            SELECT * FROM (
                SELECT
                    1 AS sort_bucket,
                    to_jsonb(e.*) AS event_row,
                    e.start_date
                FROM public.events e
                WHERE e.start_date > p_now
                ORDER BY e.start_date ASC
                LIMIT 5
            ) AS upcoming_events
        ) AS events_union;
    END IF;

    IF to_regclass('public.blogs') IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(b) ORDER BY b.date DESC, b.id DESC), '[]'::jsonb)
        INTO v_blogs
        FROM (
            SELECT *
            FROM public.blogs
            WHERE published = TRUE
            ORDER BY date DESC, id DESC
            LIMIT 10
        ) b;
    END IF;

    IF to_regclass('public.testimonials') IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.created_at DESC), '[]'::jsonb)
        INTO v_testimonials
        FROM (
            SELECT *
            FROM public.testimonials
            WHERE approved = TRUE
            ORDER BY created_at DESC
            LIMIT 10
        ) t;
    END IF;

    IF to_regclass('public.gallery_items') IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(g) ORDER BY g.order_index ASC), '[]'::jsonb)
        INTO v_gallery_items
        FROM (
            SELECT *
            FROM public.gallery_items
            ORDER BY order_index ASC
            LIMIT 10
        ) g;
    END IF;

    IF to_regclass('public.carousel_slides') IS NOT NULL THEN
        SELECT COALESCE(jsonb_agg(to_jsonb(cs) ORDER BY cs.order_index ASC), '[]'::jsonb)
        INTO v_carousel_slides
        FROM (
            SELECT *
            FROM public.carousel_slides
            WHERE is_active = TRUE
            ORDER BY order_index ASC
        ) cs;
    END IF;

    RETURN jsonb_build_object(
        'products', v_products,
        'events', v_events,
        'blogs', v_blogs,
        'testimonials', v_testimonials,
        'galleryItems', v_gallery_items,
        'carouselSlides', v_carousel_slides
    );
END;
$$;

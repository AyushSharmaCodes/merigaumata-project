-- Consolidated RPCs for Final Performance Hardening
-- Created: 2026-04-13

-- 1. CONSOLIDATED ORDER SUMMARY STATS
CREATE OR REPLACE FUNCTION get_order_summary_stats_v2()
RETURNS json AS $$
DECLARE
    result json;
    refunded_orders record;
    refunded_cancelled_count int := 0;
    refunded_returned_count int := 0;
BEGIN
    -- Aggregated counts in a single query with sub-selects for maximum efficiency
    WITH counts AS (
        SELECT
            (SELECT count(*) FROM public.orders) as total_orders,
            (SELECT count(*) FROM public.orders WHERE status IN ('pending', 'confirmed')) as new_orders,
            (SELECT count(*) FROM public.orders WHERE status IN ('processing', 'packed', 'shipped', 'out_for_delivery', 'return_approved', 'return_picked_up')) as processing_orders,
            (SELECT count(*) FROM public.orders WHERE status = 'cancelled') as cancelled_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status IN ('returned', 'partially_returned', 'partially_refunded')) as returned_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status = 'delivery_unsuccessful' OR delivery_unsuccessful_reason IS NOT NULL) as delivery_failed,
            (SELECT count(*) FROM public.orders WHERE payment_status = 'failed') as payment_failed,
            (SELECT count(*) FROM public.orders WHERE status = 'return_requested') as return_requested_orders
    )
    SELECT json_build_object(
        'totalOrders', c.total_orders,
        'newOrders', c.new_orders,
        'processingOrders', c.processing_orders,
        'cancelledOrdersRaw', c.cancelled_orders_raw,
        'returnedOrdersRaw', c.returned_orders_raw,
        'deliveryFailed', c.delivery_failed,
        'paymentFailed', c.payment_failed,
        'returnRequestedOrders', c.return_requested_orders
    ) INTO result
    FROM counts c;

    -- Special handling for complex "refunded" state logic (split by returns presence)
    FOR refunded_orders IN 
        SELECT id, (SELECT count(*) FROM public.returns r WHERE r.order_id = o.id) > 0 as has_return
        FROM public.orders o 
        WHERE status = 'refunded'
    LOOP
        IF refunded_orders.has_return THEN
            refunded_returned_count := refunded_returned_count + 1;
        ELSE
            refunded_cancelled_count := refunded_cancelled_count + 1;
        END IF;
    END LOOP;

    -- Merge the special counts
    result := result::jsonb || jsonb_build_object(
        'cancelledOrders', (result->>'cancelledOrdersRaw')::int + refunded_cancelled_count,
        'returnedOrders', (result->>'returnedOrdersRaw')::int + refunded_returned_count,
        'failedOrders', (result->>'deliveryFailed')::int + (result->>'paymentFailed')::int
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. CONSOLIDATED PRODUCT DETAIL (Product + Variants + Configs)
CREATE OR REPLACE FUNCTION get_product_detail_consolidated(p_id uuid)
RETURNS json AS $$
DECLARE
    v_product json;
    v_variants json;
    v_configs json;
BEGIN
    -- Fetch Product
    SELECT row_to_json(p) INTO v_product 
    FROM (
        SELECT 
            *,
            (SELECT COALESCE(count(*), 0) FROM reviews r WHERE r.product_id = products.id) as "reviewCount",
            (SELECT COALESCE(count(*), 0) FROM reviews r WHERE r.product_id = products.id AND r.rating IS NOT NULL) as "ratingCount"
        FROM products 
        WHERE id = p_id
    ) p;

    IF v_product IS NULL THEN
        RETURN NULL;
    END IF;

    -- Fetch Variants
    SELECT json_agg(row_to_json(v.*)) INTO v_variants
    FROM public.product_variants v
    WHERE v.product_id = p_id;

    -- Fetch Delivery Configs (Product and Variant level)
    SELECT json_agg(row_to_json(c.*)) INTO v_configs
    FROM public.delivery_configs c
    WHERE c.is_active = true 
    AND (
        c.product_id = p_id 
        OR c.variant_id IN (SELECT id FROM public.product_variants WHERE product_id = p_id)
    );

    RETURN json_build_object(
        'product', v_product,
        'variants', COALESCE(v_variants, '[]'::json),
        'deliveryConfigs', COALESCE(v_configs, '[]'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. CONSOLIDATED REVIEW DISTRIBUTION
CREATE OR REPLACE FUNCTION get_review_distribution(p_product_id uuid)
RETURNS json AS $$
BEGIN
    RETURN (
        SELECT json_object_agg(rating, count)
        FROM (
            SELECT rating, count(*) as count
            FROM public.reviews
            WHERE product_id = p_product_id
            GROUP BY rating
        ) s
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4. CONSOLIDATED PAGINATED REVIEWS
CREATE OR REPLACE FUNCTION get_product_reviews_paginated_v2(
    p_product_id uuid,
    p_page int DEFAULT 1,
    p_limit int DEFAULT 5
)
RETURNS json AS $$
DECLARE
    v_reviews json;
    v_total_count int;
    v_distribution json;
BEGIN
    -- 1. Total Count
    SELECT count(*) INTO v_total_count
    FROM public.reviews
    WHERE product_id = p_product_id;

    -- 2. Paginated Reviews
    SELECT json_agg(r) INTO v_reviews
    FROM (
        SELECT 
            rev.id,
            rev.product_id,
            rev.user_id,
            rev.rating,
            rev.title,
            rev.comment,
            rev.is_verified,
            rev.created_at,
            p.name as user_name,
            p.avatar_url as user_avatar
        FROM public.reviews rev
        LEFT JOIN public.profiles p ON rev.user_id = p.id
        WHERE rev.product_id = p_product_id
        ORDER BY rev.created_at DESC
        LIMIT p_limit
        OFFSET (p_page - 1) * p_limit
    ) r;

    -- 3. Distribution
    SELECT json_object_agg(rating, count) INTO v_distribution
    FROM (
        SELECT rating, count(*) as count
        FROM public.reviews
        WHERE product_id = p_product_id
        GROUP BY rating
    ) s;

    RETURN json_build_object(
        'reviews', COALESCE(v_reviews, '[]'::json),
        'totalCount', v_total_count,
        'distribution', COALESCE(v_distribution, '{}'::json)
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

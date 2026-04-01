-- Migration: Refine Net Revenue Calculation
-- Created: 2026-04-01
-- Description: Updates the get_admin_dashboard_stats_v3 function to calculate Net Revenue (Total - Refunds).

CREATE OR REPLACE FUNCTION get_admin_dashboard_stats_v3(
    p_revenue_timeframe TEXT DEFAULT 'yearly',
    p_order_summary_timeframe TEXT DEFAULT 'weekly',
    p_category_timeframe TEXT DEFAULT 'monthly',
    p_summary_timeframe TEXT DEFAULT 'weekly',
    p_orders_page INTEGER DEFAULT 1,
    p_orders_limit INTEGER DEFAULT 10,
    p_scope TEXT DEFAULT 'all'
)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB := '{}'::jsonb;
    v_start_date TIMESTAMP WITH TIME ZONE;
    v_summary_start_date TIMESTAMP WITH TIME ZONE;
    v_roles_customer_id INTEGER;
    v_roles_manager_id INTEGER;
BEGIN
    -- Get Role IDs
    SELECT id INTO v_roles_customer_id FROM public.roles WHERE name = 'customer';
    SELECT id INTO v_roles_manager_id FROM public.roles WHERE name = 'manager';

    -- SCOPE: SUMMARY (KPIs & Sparklines)
    IF p_scope = 'all' OR p_scope = 'summary' THEN
        v_summary_start_date := CASE 
            WHEN p_summary_timeframe = 'monthly' THEN NOW() - INTERVAL '30 days'
            WHEN p_summary_timeframe = 'yearly' THEN NOW() - INTERVAL '1 year'
            ELSE NOW() - INTERVAL '7 days'
        END;

        WITH 
        core_counts AS (
            SELECT
                (SELECT COUNT(*) FROM public.products) as total_products,
                (SELECT COUNT(*) FROM public.orders) as total_orders,
                (SELECT COUNT(*) FROM public.profiles WHERE role_id = v_roles_customer_id) as total_customers,
                (SELECT COUNT(*) FROM public.profiles WHERE role_id = v_roles_manager_id) as total_managers,
                (SELECT COUNT(*) FROM public.blogs) as total_blogs,
                (SELECT COUNT(*) FROM public.events WHERE end_date >= NOW()) as active_events,
                (SELECT COALESCE(SUM(amount), 0) FROM public.donations WHERE payment_status IN ('success', 'paid', 'captured')) as total_donations,
                (SELECT 
                    COALESCE(SUM(o.total_amount - (
                        SELECT COALESCE(SUM(amount), 0) FROM public.refunds r WHERE r.order_id = o.id AND r.status = 'PROCESSED'
                    )), 0)
                 FROM public.orders o 
                 WHERE o.payment_status IN ('success', 'paid', 'captured', 'REFUND_PARTIAL', 'REFUND_COMPLETED', 'refunded', 'partially_refunded', 'refund_initiated')) as total_earnings,
                (SELECT COUNT(*) FROM public.orders WHERE created_at >= v_summary_start_date) as new_orders_count,
                (SELECT COUNT(*) FROM public.profiles WHERE role_id = v_roles_customer_id AND created_at >= v_summary_start_date) as new_customers_count,
                (SELECT COALESCE(SUM(amount), 0) FROM public.donations WHERE payment_status IN ('success', 'paid', 'captured') AND created_at >= v_summary_start_date) as new_donations_amount,
                (SELECT COUNT(*) FROM public.events WHERE created_at >= v_summary_start_date) as new_events_count,
                (SELECT COUNT(*) FROM public.returns WHERE status IN ('requested', 'approved')) as pending_returns
        ),
        sparkline_days AS (
            SELECT generate_series(
                date_trunc('day', v_summary_start_date), 
                date_trunc('day', NOW()), 
                CASE 
                    WHEN p_summary_timeframe = 'yearly' THEN INTERVAL '1 month' 
                    ELSE INTERVAL '1 day' 
                END
            )::date as day
        ),
        sparkline_metrics AS (
            SELECT
                sd.day,
                (SELECT COUNT(*) FROM public.orders o WHERE 
                    CASE WHEN p_summary_timeframe = 'yearly' THEN date_trunc('month', o.created_at) = date_trunc('month', sd.day)
                    ELSE o.created_at::date = sd.day END) as orders_val,
                (SELECT COUNT(*) FROM public.profiles p WHERE p.role_id = v_roles_customer_id AND 
                    CASE WHEN p_summary_timeframe = 'yearly' THEN date_trunc('month', p.created_at) = date_trunc('month', sd.day)
                    ELSE p.created_at::date = sd.day END) as customers_val,
                (SELECT COUNT(*) FROM public.profiles p WHERE p.role_id = v_roles_manager_id AND 
                    CASE WHEN p_summary_timeframe = 'yearly' THEN date_trunc('month', p.created_at) = date_trunc('month', sd.day)
                    ELSE p.created_at::date = sd.day END) as managers_val,
                (SELECT COALESCE(SUM(amount), 0) FROM public.donations d WHERE d.payment_status IN ('success', 'paid', 'captured') AND 
                    CASE WHEN p_summary_timeframe = 'yearly' THEN date_trunc('month', d.created_at) = date_trunc('month', sd.day)
                    ELSE d.created_at::date = sd.day END) as donations_val,
                (SELECT 
                    COALESCE(SUM(o.total_amount - (
                        SELECT COALESCE(SUM(amount), 0) FROM public.refunds r WHERE r.order_id = o.id AND r.status = 'PROCESSED'
                    )), 0)
                 FROM public.orders o 
                 WHERE o.payment_status IN ('success', 'paid', 'captured', 'REFUND_PARTIAL', 'REFUND_COMPLETED', 'refunded', 'partially_refunded', 'refund_initiated') AND 
                    CASE WHEN p_summary_timeframe = 'yearly' THEN date_trunc('month', o.created_at) = date_trunc('month', sd.day)
                    ELSE o.created_at::date = sd.day END) as earnings_val
            FROM sparkline_days sd
        )
        SELECT v_result || jsonb_build_object(
            'stats', (
                SELECT jsonb_build_object(
                    'totalProducts', cc.total_products,
                    'activeEvents', cc.active_events,
                    'blogPosts', cc.total_blogs,
                    'totalOrders', cc.total_orders,
                    'totalCustomers', cc.total_customers,
                    'totalManagers', cc.total_managers,
                    'totalDonations', cc.total_donations,
                    'totalEarnings', cc.total_earnings,
                    'newOrdersCount', cc.new_orders_count,
                    'newCustomersCount', cc.new_customers_count,
                    'newDonationsAmount', cc.new_donations_amount,
                    'newEventsCount', cc.new_events_count,
                    'pendingReturns', cc.pending_returns,
                    'sparklineData', jsonb_build_object(
                        'orders', (SELECT jsonb_agg(jsonb_build_object('date', day, 'value', orders_val)) FROM sparkline_metrics),
                        'customers', (SELECT jsonb_agg(jsonb_build_object('date', day, 'value', customers_val)) FROM sparkline_metrics),
                        'managers', (SELECT jsonb_agg(jsonb_build_object('date', day, 'value', managers_val)) FROM sparkline_metrics),
                        'donations', (SELECT jsonb_agg(jsonb_build_object('date', day, 'value', donations_val)) FROM sparkline_metrics),
                        'earnings', (SELECT jsonb_agg(jsonb_build_object('date', day, 'value', earnings_val)) FROM sparkline_metrics)
                    )
                ) FROM core_counts cc
            )
        ) INTO v_result;
    END IF;

    -- SCOPE: CHARTS (Trends, Distributions)
    IF p_scope = 'all' OR p_scope = 'charts' THEN
        v_start_date := CASE 
            WHEN p_revenue_timeframe = 'weekly' THEN date_trunc('day', NOW() - INTERVAL '6 days')
            WHEN p_revenue_timeframe = 'monthly' THEN date_trunc('day', NOW() - INTERVAL '29 days')
            ELSE date_trunc('month', NOW() - INTERVAL '11 months')
        END;

        WITH 
        revenue_trend_data AS (
            SELECT
                CASE 
                    WHEN p_revenue_timeframe = 'yearly' THEN TO_CHAR(gs, 'Mon')
                    ELSE TO_CHAR(gs, 'DD Mon')
                END as name,
                (SELECT 
                    COALESCE(SUM(o.total_amount - (
                        SELECT COALESCE(SUM(amount), 0) FROM public.refunds r WHERE r.order_id = o.id AND r.status = 'PROCESSED'
                    )), 0)
                 FROM public.orders o 
                 WHERE o.payment_status IN ('success', 'paid', 'captured', 'REFUND_PARTIAL', 'REFUND_COMPLETED', 'refunded', 'partially_refunded', 'refund_initiated') AND 
                    (CASE WHEN p_revenue_timeframe = 'yearly' THEN date_trunc('month', o.created_at) = date_trunc('month', gs)
                          ELSE o.created_at::date = gs::date END)) as revenue,
                (SELECT COUNT(*) FROM public.orders o WHERE 
                    (CASE WHEN p_revenue_timeframe = 'yearly' THEN date_trunc('month', o.created_at) = date_trunc('month', gs)
                          ELSE o.created_at::date = gs::date END)) as orders,
                (SELECT COALESCE(SUM(amount), 0) FROM public.donations d WHERE d.payment_status IN ('success', 'paid', 'captured') AND 
                    (CASE WHEN p_revenue_timeframe = 'yearly' THEN date_trunc('month', d.created_at) = date_trunc('month', gs)
                          ELSE d.created_at::date = gs::date END)) as donations
            FROM (
                SELECT generate_series(
                    v_start_date,
                    date_trunc(CASE WHEN p_revenue_timeframe = 'yearly' THEN 'month' ELSE 'day' END, NOW()),
                    CASE WHEN p_revenue_timeframe = 'yearly' THEN INTERVAL '1 month' ELSE INTERVAL '1 day' END
                ) as gs
            ) as sub
            ORDER BY gs
        ),
        order_status_dist AS (
            SELECT 
                status as name, 
                COUNT(*) as value,
                CASE 
                    WHEN status = 'completed' THEN '#326a35'
                    WHEN status = 'pending' THEN '#b85c3c'
                    WHEN status = 'processing' THEN '#994426'
                    WHEN status = 'cancelled' THEN '#ef4444'
                    WHEN status = 'refunded' THEN '#6b7280'
                    ELSE '#d97706'
                END as color
            FROM public.orders
            WHERE created_at >= CASE 
                WHEN p_order_summary_timeframe = 'weekly' THEN NOW() - INTERVAL '7 days'
                WHEN p_order_summary_timeframe = 'monthly' THEN NOW() - INTERVAL '30 days'
                ELSE NOW() - INTERVAL '1 year'
            END
            GROUP BY status
        ),
        category_stats AS (
            SELECT 
                c.name as category,
                COALESCE(SUM(s.units_sold), 0) as count,
                '+0%' as trend 
            FROM public.categories c
            LEFT JOIN (
                SELECT p.category as category_name, SUM(oi.quantity) as units_sold
                FROM public.order_items oi
                JOIN public.products p ON oi.product_id = p.id
                JOIN public.orders o ON oi.order_id = o.id
                WHERE o.payment_status IN ('success', 'paid', 'captured', 'REFUND_PARTIAL', 'REFUND_COMPLETED', 'refunded', 'partially_refunded', 'refund_initiated')
                  AND o.created_at >= CASE 
                    WHEN p_category_timeframe = 'weekly' THEN NOW() - INTERVAL '7 days'
                    WHEN p_category_timeframe = 'monthly' THEN NOW() - INTERVAL '30 days'
                    ELSE NOW() - INTERVAL '1 year'
                  END
                GROUP BY p.category
            ) s ON c.name = s.category_name
            WHERE c.type = 'product'
            GROUP BY c.name
            ORDER BY count DESC
        )
        SELECT v_result || jsonb_build_object(
            'charts', jsonb_build_object(
                'revenueTrend', (SELECT jsonb_agg(rtt) FROM revenue_trend_data rtt),
                'orderStatusDistribution', (SELECT jsonb_agg(osd) FROM order_status_dist osd),
                'categoryStats', (SELECT jsonb_agg(cs) FROM category_stats cs)
            )
        ) INTO v_result;
    END IF;

    -- SCOPE: ACTIVITY (Transactions, Testimonials, Events)
    IF p_scope = 'all' OR p_scope = 'activity' THEN
        WITH 
        recent_comments_list AS (
            SELECT t.id, t.name as author, t.image as avatar, t.content as comment, t.created_at as date
            FROM public.testimonials t
            ORDER BY t.created_at DESC LIMIT 5
        ),
        recent_orders_list AS (
            SELECT o.id, o.order_number as "orderNumber", COALESCE(p.name, o.customer_name, 'Guest') as "customerName",
                   o.total_amount as amount, o.status, o.created_at as "createdAt"
            FROM public.orders o
            LEFT JOIN public.profiles p ON o.user_id = p.id
            ORDER BY o.created_at DESC
            LIMIT p_orders_limit
            OFFSET (p_orders_page - 1) * p_orders_limit
        ),
        recent_orders_pagination AS (
            SELECT COUNT(*) as total_count FROM public.orders
        ),
        ongoing_events_list AS (
            SELECT e.id, e.title, e.end_date as "endDate",
                   (SELECT COUNT(*) FROM public.event_registrations er WHERE er.event_id = e.id) as "registeredCount",
                   (SELECT COUNT(*) FROM public.event_registrations er WHERE er.event_id = e.id AND er.status = 'cancelled') as "cancelledCount"
            FROM public.events e
            WHERE e.start_date <= NOW() AND e.end_date >= NOW()
            ORDER BY e.start_date ASC LIMIT 5
        )
        SELECT v_result || jsonb_build_object(
            'recentComments', (SELECT COALESCE(jsonb_agg(rc), '[]'::jsonb) FROM recent_comments_list rc),
            'recentOrders', jsonb_build_object(
                'data', (SELECT COALESCE(jsonb_agg(ro), '[]'::jsonb) FROM recent_orders_list ro),
                'pagination', (SELECT jsonb_build_object(
                    'total', total_count, 
                    'page', p_orders_page, 
                    'limit', p_orders_limit, 
                    'pages', CASE WHEN p_orders_limit > 0 THEN CEIL(total_count::FLOAT / p_orders_limit) ELSE 1 END
                ) FROM recent_orders_pagination)
            ),
            'ongoingEvents', (SELECT COALESCE(jsonb_agg(oe), '[]'::jsonb) FROM ongoing_events_list oe)
        ) INTO v_result;
    END IF;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

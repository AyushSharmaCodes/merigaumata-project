-- Migration: Add delivery recovery and return-to-origin statuses to orders
-- Description:
--   Expands the order status constraint to support:
--   1. delivery_reattempt_scheduled
--   2. rto_in_transit
--   3. returned_to_origin
--   Also adds a focused partial index for operational dashboards that monitor
--   delivery-failure recovery without scanning unrelated rows.

DO $$
DECLARE
    constraint_name TEXT;
BEGIN
    SELECT conname INTO constraint_name
    FROM pg_constraint
    WHERE conrelid = 'public.orders'::regclass
      AND contype = 'c'
      AND conname LIKE '%status%'
      AND conname NOT LIKE '%payment%';

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.orders DROP CONSTRAINT ' || quote_ident(constraint_name);
    END IF;
END $$;

ALTER TABLE public.orders
ADD CONSTRAINT orders_status_check
CHECK (status IN (
    'pending',
    'confirmed',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'delivery_unsuccessful',
    'delivery_reattempt_scheduled',
    'rto_in_transit',
    'returned_to_origin',
    'cancelled',
    'cancelled_by_admin',
    'cancelled_by_customer',
    'return_requested',
    'return_approved',
    'return_rejected',
    'return_cancelled',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'pickup_failed',
    'picked_up',
    'in_transit_to_warehouse',
    'partially_returned',
    'returned',
    'qc_initiated',
    'qc_passed',
    'qc_failed',
    'partial_refund',
    'zero_refund',
    'gateway_processing',
    'return_back_to_customer',
    'dispose_liquidate',
    'refunded',
    'failed',
    'partially_refunded'
));

CREATE INDEX IF NOT EXISTS idx_orders_delivery_recovery_status
ON public.orders(status, updated_at DESC)
WHERE status IN (
    'delivery_unsuccessful',
    'delivery_reattempt_scheduled',
    'rto_in_transit',
    'returned_to_origin'
);

CREATE OR REPLACE FUNCTION get_order_summary_stats_v2()
RETURNS json AS $$
DECLARE
    result json;
    refunded_orders record;
    refunded_cancelled_count int := 0;
    refunded_returned_count int := 0;
BEGIN
    WITH counts AS (
        SELECT
            (SELECT count(*) FROM public.orders) as total_orders,
            (SELECT count(*) FROM public.orders WHERE status IN ('pending', 'confirmed')) as new_orders,
            (SELECT count(*) FROM public.orders WHERE status IN (
                'processing',
                'packed',
                'shipped',
                'out_for_delivery',
                'delivery_reattempt_scheduled',
                'rto_in_transit',
                'return_approved',
                'return_picked_up'
            )) as processing_orders,
            (SELECT count(*) FROM public.orders WHERE status = 'cancelled') as cancelled_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status IN ('returned', 'partially_returned', 'partially_refunded', 'returned_to_origin')) as returned_orders_raw,
            (SELECT count(*) FROM public.orders WHERE status IN ('delivery_unsuccessful', 'delivery_reattempt_scheduled', 'rto_in_transit', 'returned_to_origin') OR delivery_unsuccessful_reason IS NOT NULL) as delivery_failed,
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

    result := result::jsonb || jsonb_build_object(
        'cancelledOrders', (result->>'cancelledOrdersRaw')::int + refunded_cancelled_count,
        'returnedOrders', (result->>'returnedOrdersRaw')::int + refunded_returned_count,
        'failedOrders', (result->>'deliveryFailed')::int + (result->>'paymentFailed')::int
    );

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION verify_event_registration_transactional(
    p_registration_id UUID,
    p_razorpay_payment_id TEXT,
    p_razorpay_signature TEXT,
    p_invoice_url TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_registration RECORD;
    v_event RECORD;
BEGIN
    -- 1. UPDATE REGISTRATION STATUS
    UPDATE event_registrations
    SET 
        payment_status = 'paid',
        razorpay_payment_id = p_razorpay_payment_id,
        razorpay_signature = p_razorpay_signature,
        status = 'confirmed',
        updated_at = NOW()
    WHERE id = p_registration_id
    RETURNING * INTO v_registration;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Registration not found: %', p_registration_id;
    END IF;

    -- 2. GET EVENT DETAILS FOR RESPONSE
    SELECT * INTO v_event
    FROM events
    WHERE id = v_registration.event_id;

    -- Return updated registration with event details
    RETURN jsonb_build_object(
        'success', TRUE,
        'registration', jsonb_build_object(
            'id', v_registration.id,
            'registration_number', v_registration.registration_number,
            'event_id', v_registration.event_id,
            'full_name', v_registration.full_name,
            'email', v_registration.email,
            'status', v_registration.status,
            'payment_status', v_registration.payment_status,
            'amount', v_registration.amount,
            'base_price', v_registration.base_price,
            'gst_amount', v_registration.gst_amount,
            'gst_rate', v_registration.gst_rate,
            'user_id', v_registration.user_id
        ),
        'event', jsonb_build_object(
            'id', v_event.id,
            'title', v_event.title,
            'start_date', v_event.start_date,
            'location', v_event.location,
            'description', v_event.description,
            'event_code', v_event.event_code
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Event registration verification failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_event_registration_transactional TO service_role;

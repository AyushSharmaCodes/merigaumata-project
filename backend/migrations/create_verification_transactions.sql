-- Migration: Verify Event Registration Transaction Function
-- Purpose: Atomically updates event registration after payment verification
-- Also handles invoice URL storage if provided

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

COMMENT ON FUNCTION verify_event_registration_transactional IS 
'Atomically updates event registration status after payment verification.';


-- ============================================
-- Donation Verification Transaction Function
-- ============================================

CREATE OR REPLACE FUNCTION verify_donation_transactional(
    p_razorpay_order_id TEXT,
    p_razorpay_payment_id TEXT,
    p_payment_status TEXT DEFAULT 'success'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_donation RECORD;
BEGIN
    -- 1. UPDATE DONATION STATUS
    UPDATE donations
    SET 
        payment_status = p_payment_status,
        razorpay_payment_id = p_razorpay_payment_id,
        updated_at = NOW()
    WHERE razorpay_order_id = p_razorpay_order_id
    RETURNING * INTO v_donation;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Donation not found for order: %', p_razorpay_order_id;
    END IF;

    -- Return updated donation
    RETURN jsonb_build_object(
        'success', TRUE,
        'donation', jsonb_build_object(
            'id', v_donation.id,
            'donation_reference_id', v_donation.donation_reference_id,
            'amount', v_donation.amount,
            'payment_status', v_donation.payment_status,
            'donor_name', v_donation.donor_name,
            'donor_email', v_donation.donor_email,
            'user_id', v_donation.user_id,
            'created_at', v_donation.created_at,
            'is_anonymous', v_donation.is_anonymous
        )
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Donation verification failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION verify_donation_transactional TO service_role;

COMMENT ON FUNCTION verify_donation_transactional IS 
'Atomically updates donation status after payment verification.';

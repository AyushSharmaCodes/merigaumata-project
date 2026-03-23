-- Migration: Create Subscription Transaction Function
-- Purpose: Atomically creates a donation subscription with initial donation record
-- If any step fails, the entire transaction is rolled back

CREATE OR REPLACE FUNCTION create_subscription_transactional(
    p_user_id UUID,
    p_donation_ref TEXT,
    p_razorpay_subscription_id TEXT,
    p_razorpay_plan_id TEXT,
    p_amount NUMERIC,
    p_donor_name TEXT,
    p_donor_email TEXT DEFAULT NULL,
    p_donor_phone TEXT DEFAULT NULL,
    p_is_anonymous BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription_id UUID;
    v_donation_id UUID;
BEGIN
    -- 1. CREATE SUBSCRIPTION LIFECYCLE RECORD
    INSERT INTO donation_subscriptions (
        user_id,
        donation_reference_id,
        razorpay_subscription_id,
        razorpay_plan_id,
        amount,
        status,
        donor_name,
        donor_email,
        donor_phone,
        is_anonymous,
        created_at
    ) VALUES (
        p_user_id,
        p_donation_ref,
        p_razorpay_subscription_id,
        p_razorpay_plan_id,
        p_amount,
        'created',
        p_donor_name,
        p_donor_email,
        p_donor_phone,
        p_is_anonymous,
        NOW()
    )
    RETURNING id INTO v_subscription_id;

    -- 2. CREATE INITIAL DONATION INTENT
    INSERT INTO donations (
        donation_reference_id,
        user_id,
        type,
        amount,
        donor_name,
        donor_email,
        donor_phone,
        is_anonymous,
        payment_status,
        razorpay_subscription_id,
        created_at
    ) VALUES (
        p_donation_ref,
        p_user_id,
        'monthly',
        p_amount,
        p_donor_name,
        p_donor_email,
        p_donor_phone,
        p_is_anonymous,
        'pending',
        p_razorpay_subscription_id,
        NOW()
    )
    RETURNING id INTO v_donation_id;

    -- Return success with IDs
    RETURN jsonb_build_object(
        'success', TRUE,
        'subscription_id', v_subscription_id,
        'donation_id', v_donation_id,
        'donation_ref', p_donation_ref
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction is automatically rolled back on exception
        RAISE EXCEPTION 'Subscription creation failed: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_subscription_transactional TO service_role;

COMMENT ON FUNCTION create_subscription_transactional IS 
'Atomically creates a donation subscription and initial donation record. 
Rolls back both if either fails.';

-- ============================================
-- Update Subscription Status Transaction
-- ============================================

CREATE OR REPLACE FUNCTION update_subscription_status_transactional(
    p_user_id UUID,
    p_razorpay_subscription_id TEXT,
    p_new_status TEXT,
    p_action TEXT  -- 'cancel', 'pause', 'resume'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_subscription RECORD;
BEGIN
    -- 1. VERIFY OWNERSHIP AND CURRENT STATUS
    SELECT * INTO v_subscription
    FROM donation_subscriptions
    WHERE razorpay_subscription_id = p_razorpay_subscription_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Subscription not found or unauthorized';
    END IF;

    -- 2. VALIDATE STATUS TRANSITION
    IF p_action = 'cancel' AND v_subscription.status = 'cancelled' THEN
        RAISE EXCEPTION 'Subscription is already cancelled';
    END IF;

    IF p_action = 'pause' AND v_subscription.status = 'paused' THEN
        RAISE EXCEPTION 'Subscription is already paused';
    END IF;

    IF p_action = 'resume' AND v_subscription.status = 'active' THEN
        RAISE EXCEPTION 'Subscription is already active';
    END IF;

    -- 3. UPDATE STATUS
    UPDATE donation_subscriptions
    SET status = p_new_status,
        updated_at = NOW()
    WHERE razorpay_subscription_id = p_razorpay_subscription_id
      AND user_id = p_user_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'subscription_id', v_subscription.id,
        'old_status', v_subscription.status,
        'new_status', p_new_status
    );

EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Subscription update failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION update_subscription_status_transactional TO service_role;

COMMENT ON FUNCTION update_subscription_status_transactional IS 
'Atomically updates subscription status with validation. Used after Razorpay API call succeeds.';

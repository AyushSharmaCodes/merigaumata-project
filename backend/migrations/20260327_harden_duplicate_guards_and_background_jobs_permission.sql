ALTER TABLE manager_permissions
ADD COLUMN IF NOT EXISTS can_manage_background_jobs BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_orders_payment_id_not_null
ON orders(payment_id)
WHERE payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_active_user_event
ON event_registrations(event_id, user_id)
WHERE user_id IS NOT NULL
  AND status NOT IN ('cancelled', 'refunded', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_active_email_event
ON event_registrations(event_id, lower(email))
WHERE status NOT IN ('cancelled', 'refunded', 'failed');

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_razorpay_order_id
ON event_registrations(razorpay_order_id)
WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_event_registrations_razorpay_payment_id
ON event_registrations(razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_donations_razorpay_order_id
ON donations(razorpay_order_id)
WHERE razorpay_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_donations_razorpay_payment_id
ON donations(razorpay_payment_id)
WHERE razorpay_payment_id IS NOT NULL;

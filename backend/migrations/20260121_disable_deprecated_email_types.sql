-- Migration: Document deprecated email types and add policy enforcement
-- Created: 2026-01-21
-- Purpose: Document the email notification policy limiting customer emails to 6 order states

-- Add comment to email_notifications table documenting the policy
COMMENT ON TABLE email_notifications IS 
'Email notification log table. 
POLICY: Customer-facing order emails are LIMITED to 6 states:
1. ORDER_PLACED (pending) - Customer completes payment
2. ORDER_CONFIRMED (confirmed) - Admin confirms order  
3. ORDER_SHIPPED (shipped) - Order is shipped
4. ORDER_DELIVERED (delivered) - Order is delivered
5. ORDER_CANCELLED (cancelled) - Order is cancelled
6. ORDER_RETURNED (returned) - Return is completed

DEPRECATED email types (no longer sent):
- PAYMENT_CONFIRMED
- GST_INVOICE_GENERATED
- RETURN_REQUESTED
- RETURN_APPROVED
- RETURN_REJECTED
- REFUND_INITIATED
- REFUND_COMPLETED

Customers can view invoice, return, and refund status on the order details page.';

-- Optional: Add a check constraint to prevent deprecated email types (commented out by default)
-- Uncomment if you want to enforce this at the database level
/*
ALTER TABLE email_notifications
DROP CONSTRAINT IF EXISTS email_notifications_deprecated_types_check;

ALTER TABLE email_notifications
ADD CONSTRAINT email_notifications_deprecated_types_check
CHECK (
    email_type NOT IN (
        'PAYMENT_CONFIRMED',
        'GST_INVOICE_GENERATED',
        'RETURN_REQUESTED',
        'RETURN_APPROVED',
        'RETURN_REJECTED',
        'REFUND_INITIATED',
        'REFUND_COMPLETED'
    )
);
*/

-- Add index on email_type for faster queries
CREATE INDEX IF NOT EXISTS idx_email_notifications_type_created 
ON email_notifications(email_type, created_at DESC);

-- Log this migration
INSERT INTO schema_migrations (version, description) 
VALUES ('20260121_disable_deprecated_email_types', 'Document email policy and deprecated types')
ON CONFLICT (version) DO NOTHING;

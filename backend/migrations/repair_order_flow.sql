-- 1. Fix email_notification_type enum
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'email_notification_type' AND e.enumlabel = 'GST_INVOICE_GENERATED') THEN
        ALTER TYPE email_notification_type ADD VALUE 'GST_INVOICE_GENERATED';
    END IF;
END $$;

-- 2. Fix email_notifications status check constraint
-- First find the constraint name
DO $$
DECLARE
    v_constraint_name TEXT;
BEGIN
    SELECT conname INTO v_constraint_name
    FROM pg_constraint 
    WHERE conrelid = 'email_notifications'::regclass AND contype = 'c' AND conname LIKE '%status_check%';

    IF v_constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE email_notifications DROP CONSTRAINT ' || v_constraint_name;
    END IF;
    
    ALTER TABLE email_notifications ADD CONSTRAINT email_notifications_status_check 
    CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'LOGGED'));
END $$;

-- 3. Verify order_status_history policies
-- Ensure service_role has access (usually true by default if no restrictive policies exist)
-- We will add an explicit policy just in case.
DROP POLICY IF EXISTS "Service Role can do anything on history" ON order_status_history;
CREATE POLICY "Service Role can do anything on history" ON order_status_history
FOR ALL TO service_role USING (true) WITH CHECK (true);

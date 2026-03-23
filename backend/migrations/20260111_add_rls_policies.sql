-- Migration: Add Row Level Security policies for order_status_history and email_notifications
-- These tables were missing RLS policies, exposing them to unauthorized access
-- Fixed to use role_id with JOIN to roles table

-- ==============================================================================
-- ORDER_STATUS_HISTORY TABLE RLS
-- ==============================================================================

-- Enable RLS on order_status_history
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert (backend creates status history entries)
CREATE POLICY "Service role can insert order status history"
    ON order_status_history
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Policy: Service role can select all (for admin dashboard)
CREATE POLICY "Service role can view all order status history"
    ON order_status_history
    FOR SELECT
    TO service_role
    USING (true);

-- Policy: Users can view status history for their own orders
CREATE POLICY "Users can view their own order status history"
    ON order_status_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM orders 
            WHERE orders.id = order_status_history.order_id 
            AND orders.user_id = auth.uid()
        )
    );

-- Policy: Admins/Managers can view all status history (via profiles + roles table)
CREATE POLICY "Admins can view all order status history"
    ON order_status_history
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() 
            AND roles.name IN ('admin', 'manager')
        )
    );

-- ==============================================================================
-- EMAIL_NOTIFICATIONS TABLE RLS
-- ==============================================================================

-- Enable RLS on email_notifications
ALTER TABLE email_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Service role can insert (backend logs emails)
CREATE POLICY "Service role can insert email notifications"
    ON email_notifications
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Policy: Service role can select and update all (for admin dashboard and retries)
CREATE POLICY "Service role can manage all email notifications"
    ON email_notifications
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Users can view their own email notifications
CREATE POLICY "Users can view their own email notifications"
    ON email_notifications
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Policy: Admins/Managers can view all email notifications
CREATE POLICY "Admins can view all email notifications"
    ON email_notifications
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid() 
            AND roles.name IN ('admin', 'manager')
        )
    );

-- ==============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ==============================================================================

-- Ensure authenticated users can access these tables (subject to RLS)
GRANT SELECT ON order_status_history TO authenticated;
GRANT SELECT ON email_notifications TO authenticated;

-- Service role needs full access
GRANT ALL ON order_status_history TO service_role;
GRANT ALL ON email_notifications TO service_role;

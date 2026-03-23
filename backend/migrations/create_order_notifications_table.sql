-- Create order_notifications table for admin alerts
CREATE TABLE IF NOT EXISTS order_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    admin_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'archived')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_order_notifications_admin ON order_notifications(admin_id, status);
CREATE INDEX IF NOT EXISTS idx_order_notifications_order ON order_notifications(order_id);
CREATE INDEX IF NOT EXISTS idx_order_notifications_status ON order_notifications(status);
CREATE INDEX IF NOT EXISTS idx_order_notifications_created ON order_notifications(created_at DESC);

-- Enable Row Level Security
ALTER TABLE order_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can view their notifications
DROP POLICY IF EXISTS "Admins can view notifications" ON order_notifications;
CREATE POLICY "Admins can view notifications" ON order_notifications
    FOR SELECT
    USING (
        admin_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid()
            AND roles.name = 'admin'
        )
    );

-- System can insert notifications (no user constraint)
DROP POLICY IF EXISTS "Enable insert for notifications" ON order_notifications;
CREATE POLICY "Enable insert for notifications" ON order_notifications
    FOR INSERT
    WITH CHECK (true);

-- Admins can update their own notifications
DROP POLICY IF EXISTS "Admins can update notifications" ON order_notifications;
CREATE POLICY "Admins can update notifications" ON order_notifications
    FOR UPDATE
    USING (
        admin_id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM profiles
            JOIN roles ON profiles.role_id = roles.id
            WHERE profiles.id = auth.uid()
            AND roles.name = 'admin'
        )
    );

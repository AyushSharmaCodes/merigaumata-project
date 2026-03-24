-- Create enum for email types
CREATE TYPE email_notification_type AS ENUM (
    'REGISTRATION',
    'ORDER_CONFIRMATION', 
    'ORDER_SHIPPED',
    'ORDER_DELIVERED',
    'EVENT_REGISTRATION',
    'DONATION_RECEIPT',
    'SUBSCRIPTION_STARTED',
    'SUBSCRIPTION_CANCELLED',
    'SUBSCRIPTION_RENEWED',
    'SUBSCRIPTION_PAUSED',
    'SUBSCRIPTION_RESUMED', 
    'OTP_VERIFICATION',
    'PASSWORD_RESET',
    'ACCOUNT_DELETED',
    'ACCOUNT_DELETION_SCHEDULED',
    'ACCOUNT_DELETION_OTP',
    'MANAGER_WELCOME'
);

-- Create email_notifications table
CREATE TABLE IF NOT EXISTS email_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id),
    email_type email_notification_type NOT NULL,
    recipient_email TEXT NOT NULL,
    reference_id TEXT, -- e.g. order_id, event_reg_id
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    sent_at TIMESTAMP WITH TIME ZONE
);

-- Create index for faster queries
CREATE INDEX idx_email_notifications_user_id ON email_notifications(user_id);
CREATE INDEX idx_email_notifications_status ON email_notifications(status);
CREATE INDEX idx_email_notifications_email_type ON email_notifications(email_type);

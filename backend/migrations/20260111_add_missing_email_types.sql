-- Migration: Add missing email notification types to enum
-- This adds new email types that were added to the application

-- Add missing enum values to email_notification_type
-- Note: PostgreSQL requires ALTER TYPE ... ADD VALUE for each new value

-- User Authentication types
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'USER_REGISTRATION';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'EMAIL_CONFIRMATION';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'PASSWORD_CHANGED';

-- Order types
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ORDER_STATUS_UPDATE';

-- Event types
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'EVENT_CANCELLATION';

-- Contact types
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'CONTACT_FORM';

-- Subscription types (if not already present)
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_PAUSED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'SUBSCRIPTION_RESUMED';

-- Note: These values will be added at the end of the enum.
-- If you need them in a specific order, you may need to recreate the type.

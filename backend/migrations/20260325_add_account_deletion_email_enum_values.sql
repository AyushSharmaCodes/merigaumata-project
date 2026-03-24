-- Migration: Add account-deletion and account-management email event types.
-- Description: Keeps database logging enum aligned with application email events.

ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION_SCHEDULED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ACCOUNT_DELETION_OTP';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'MANAGER_WELCOME';

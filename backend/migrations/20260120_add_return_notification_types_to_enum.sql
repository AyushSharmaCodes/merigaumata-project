-- Migration: Add return notification types to email_notification_type enum
-- Description: Adds RETURN_REQUESTED, RETURN_APPROVED, and RETURN_REJECTED to the enum.

ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'RETURN_REQUESTED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'RETURN_APPROVED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'RETURN_REJECTED';

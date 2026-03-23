-- Migration: Add granular email notification types to email_notification_type enum
-- Description: Adds ORDER_PLACED, ORDER_CONFIRMED, ORDER_CANCELLED, and ORDER_RETURNED to the enum.
-- This allows the application to log these specific events accurately in the future.

ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ORDER_PLACED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ORDER_CONFIRMED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ORDER_CANCELLED';
ALTER TYPE email_notification_type ADD VALUE IF NOT EXISTS 'ORDER_RETURNED';

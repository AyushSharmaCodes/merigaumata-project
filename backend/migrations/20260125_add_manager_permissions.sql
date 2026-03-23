-- Add missing permission columns to manager_permissions table
ALTER TABLE manager_permissions 
ADD COLUMN IF NOT EXISTS can_manage_reviews BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_policies BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_contact_messages BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_coupons BOOLEAN DEFAULT false;

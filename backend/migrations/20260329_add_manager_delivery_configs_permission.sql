-- Add can_manage_delivery_configs to manager_permissions table
ALTER TABLE manager_permissions
ADD COLUMN IF NOT EXISTS can_manage_delivery_configs BOOLEAN DEFAULT false;

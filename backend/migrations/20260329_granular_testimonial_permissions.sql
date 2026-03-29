-- Add granular testimonial permissions to manager_permissions table
ALTER TABLE manager_permissions 
ADD COLUMN IF NOT EXISTS can_add_testimonials BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_approve_testimonials BOOLEAN DEFAULT false;

-- Migrate existing can_manage_testimonials to the new columns
UPDATE manager_permissions 
SET can_add_testimonials = can_manage_testimonials,
    can_approve_testimonials = can_manage_testimonials
WHERE can_manage_testimonials = true;

-- Add comment for documentation
COMMENT ON COLUMN manager_permissions.can_add_testimonials IS 'Allows manager to add new testimonials';
COMMENT ON COLUMN manager_permissions.can_approve_testimonials IS 'Allows manager to approve/reject testimonials (and their own additions are auto-approved)';

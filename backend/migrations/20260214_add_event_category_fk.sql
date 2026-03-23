-- Migration to add foreign key constraint for event categories
-- This enables Supabase to perform JOINs between events and categories based on the category name string

-- 1. First, ensure categories.name has a unique constraint (required for FK reference)
-- We check for existence of the constraint first to avoid errors
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'categories_name_key'
    ) THEN
        ALTER TABLE categories ADD CONSTRAINT categories_name_key UNIQUE (name);
    END IF;
END $$;

-- 2. Add the foreign key constraint to events
-- This allows Supabase (and our manual joins) to reference category data reliably
ALTER TABLE events
DROP CONSTRAINT IF EXISTS fk_event_category;

ALTER TABLE events
ADD CONSTRAINT fk_event_category
FOREIGN KEY (category)
REFERENCES categories(name)
ON UPDATE CASCADE
ON DELETE SET NULL;

-- Remove the CHECK constraint on folder_type to allow dynamic categories
ALTER TABLE gallery_folders DROP CONSTRAINT IF EXISTS gallery_folders_folder_type_check;

-- Optionally, if you want to add a foreign key constraint to a categories table later, you can do that here.
-- For now, we just allow any string value.

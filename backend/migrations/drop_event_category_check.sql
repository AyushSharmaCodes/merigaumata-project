-- Migration: Drop obsolete event category check constraint
-- Purpose: The events table has a hardcoded CHECK constraint on category values that
-- conflicts with the new dynamic category system (which uses a Foreign Key to the categories table).

-- 1. Drop the constraint
ALTER TABLE events DROP CONSTRAINT IF EXISTS events_category_check;

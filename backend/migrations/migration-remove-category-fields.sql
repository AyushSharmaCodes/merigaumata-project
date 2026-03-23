-- Migration: Remove description and image columns from categories table
-- Run this in Supabase SQL Editor

ALTER TABLE categories DROP COLUMN IF EXISTS description;
ALTER TABLE categories DROP COLUMN IF EXISTS image;

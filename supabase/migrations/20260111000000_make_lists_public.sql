-- Migration: Make all wedding lists public by default

-- 1. Update existing lists to be public
UPDATE wedding_lists 
SET is_public = true 
WHERE is_public = false;

-- 2. Alter table to set default to true
ALTER TABLE wedding_lists 
ALTER COLUMN is_public SET DEFAULT true;

-- 3. (Optional) Force not null if not already
ALTER TABLE wedding_lists 
ALTER COLUMN is_public SET NOT NULL;

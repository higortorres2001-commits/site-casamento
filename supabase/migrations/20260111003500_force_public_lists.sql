-- Force all existing lists to be public
UPDATE wedding_lists SET is_public = true;

-- Set the default value for new lists to true
ALTER TABLE wedding_lists ALTER COLUMN is_public SET DEFAULT true;

-- Optional: You might want to remove the check constraint if you had one, or a policy update.
-- For now, this ensures data consistency.

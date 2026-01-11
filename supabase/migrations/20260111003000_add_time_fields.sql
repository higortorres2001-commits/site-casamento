-- Add time fields and party toggle to wedding_lists
ALTER TABLE wedding_lists
ADD COLUMN IF NOT EXISTS ceremony_time TEXT,
ADD COLUMN IF NOT EXISTS party_time TEXT,
ADD COLUMN IF NOT EXISTS has_party BOOLEAN DEFAULT false;

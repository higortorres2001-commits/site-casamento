-- Add couple_profile_image column to wedding_lists table
ALTER TABLE wedding_lists ADD COLUMN IF NOT EXISTS couple_profile_image TEXT;

-- We can keep bride_image and groom_image for now to avoid data loss during transition, 
-- or drop them if we are sure. Since they were apparently unused in UI, it's safer to just ignore them.
-- Eventually:
-- ALTER TABLE wedding_lists DROP COLUMN bride_image;
-- ALTER TABLE wedding_lists DROP COLUMN groom_image;

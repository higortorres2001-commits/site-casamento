ALTER TABLE gifts
ADD COLUMN IF NOT EXISTS is_quota BOOLEAN DEFAULT false;

-- Optional: Comments for documentation
COMMENT ON COLUMN gifts.is_quota IS 'Indicates if the gift is a quota (e.g., share of a trip) vs a physical product with multiple units';

-- Migration: Add source column to rsvp_responses for audit
-- Description: Track RSVP source (magic_link, public_search, admin) for moderation
-- Date: 2026-01-10

-- Add source column
ALTER TABLE rsvp_responses 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'magic_link' CHECK (source IN ('magic_link', 'public_search', 'admin'));

-- Add validation_status for moderation of public_search RSVPs
ALTER TABLE rsvp_responses 
ADD COLUMN IF NOT EXISTS validation_status TEXT DEFAULT 'validated' CHECK (validation_status IN ('pending', 'validated', 'rejected'));

-- Add index for quick lookup of pending validations
CREATE INDEX IF NOT EXISTS idx_rsvp_validation_pending 
ON rsvp_responses(wedding_list_id, validation_status) 
WHERE validation_status = 'pending';

-- Comment
COMMENT ON COLUMN rsvp_responses.source IS 'RSVP source: magic_link (direct link), public_search (needs moderation), admin (manual)';
COMMENT ON COLUMN rsvp_responses.validation_status IS 'Moderation status for public_search RSVPs: pending, validated, rejected';

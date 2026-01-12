-- Migration: Make guest_email nullable in rsvp_responses
-- Description: guest_email is no longer required since we now link RSVPs via guest_id
-- Date: 2026-01-12

-- Drop existing unique constraint on guest_email
DROP INDEX IF EXISTS idx_rsvp_unique_email_per_list;

-- Make guest_email nullable
ALTER TABLE rsvp_responses 
ALTER COLUMN guest_email DROP NOT NULL;

-- Add comment explaining the change
COMMENT ON COLUMN rsvp_responses.guest_email IS 'Guest email - now optional since RSVPs are linked via guest_id. Kept for backwards compatibility.';

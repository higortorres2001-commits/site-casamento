-- Migration: Add email notification tracking columns to wedding_lists
-- This enables the smart email strategy: daily digest + first gift notification

-- Add flag to track if we already sent the "first gift" celebration email
ALTER TABLE wedding_lists 
ADD COLUMN IF NOT EXISTS first_gift_notified BOOLEAN DEFAULT FALSE;

-- Add timestamp to track when we last sent a daily digest (to avoid duplicates)
ALTER TABLE wedding_lists 
ADD COLUMN IF NOT EXISTS last_digest_sent_at TIMESTAMPTZ;

-- Add couple's notification email (in case they want a different email than auth email)
ALTER TABLE wedding_lists 
ADD COLUMN IF NOT EXISTS notification_email TEXT;

COMMENT ON COLUMN wedding_lists.first_gift_notified IS 'True after we send the special first-gift celebration email';
COMMENT ON COLUMN wedding_lists.last_digest_sent_at IS 'Timestamp of last daily digest sent; used to aggregate new activity';
COMMENT ON COLUMN wedding_lists.notification_email IS 'Optional custom email for notifications (defaults to auth email)';

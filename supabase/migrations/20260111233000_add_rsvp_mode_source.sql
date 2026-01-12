-- Add RSVP Mode to Wedding Lists
ALTER TABLE wedding_lists 
ADD COLUMN IF NOT EXISTS rsvp_mode text DEFAULT 'closed' CHECK (rsvp_mode IN ('open', 'closed'));

-- Add Source to Envelopes (to track if created manually by admin or publicly by guest)
ALTER TABLE envelopes 
ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual' CHECK (source IN ('manual', 'public'));

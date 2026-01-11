-- Migration: Guest Messages and RSVP Tables
-- Description: Add tables for message wall and RSVP functionality
-- Date: 2026-01-10

-- ============================================================================
-- STEP 1: Create guest_messages table
-- ============================================================================

CREATE TABLE IF NOT EXISTS guest_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_list_id UUID NOT NULL REFERENCES wedding_lists(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  message TEXT NOT NULL,
  photo_url TEXT,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE guest_messages IS 'Mensagens dos convidados para os noivos';
COMMENT ON COLUMN guest_messages.is_visible IS 'Se false, mensagem oculta pelos noivos';

-- Create index
CREATE INDEX IF NOT EXISTS idx_guest_messages_wedding_list_id ON guest_messages(wedding_list_id);

-- ============================================================================
-- STEP 2: Create rsvp_responses table
-- ============================================================================

CREATE TABLE IF NOT EXISTS rsvp_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_list_id UUID NOT NULL REFERENCES wedding_lists(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  attending TEXT CHECK (attending IN ('yes', 'no', 'maybe')),
  companions INTEGER DEFAULT 0,
  dietary_restrictions TEXT,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE rsvp_responses IS 'Confirmações de presença dos convidados';
COMMENT ON COLUMN rsvp_responses.attending IS 'Status: yes, no, maybe';
COMMENT ON COLUMN rsvp_responses.companions IS 'Número de acompanhantes';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_wedding_list_id ON rsvp_responses(wedding_list_id);
CREATE INDEX IF NOT EXISTS idx_rsvp_responses_guest_email ON rsvp_responses(guest_email);

-- Unique constraint to prevent duplicate RSVPs
CREATE UNIQUE INDEX IF NOT EXISTS idx_rsvp_unique_email_per_list 
  ON rsvp_responses(wedding_list_id, guest_email);

-- ============================================================================
-- STEP 3: Enable RLS and create policies
-- ============================================================================

-- Enable RLS
ALTER TABLE guest_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE rsvp_responses ENABLE ROW LEVEL SECURITY;

-- Guest Messages Policies

-- Anyone can view messages from public lists
DROP POLICY IF EXISTS "Anyone can view messages from public lists" ON guest_messages;
CREATE POLICY "Anyone can view messages from public lists" ON guest_messages
  FOR SELECT USING (
    is_visible = true AND
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = guest_messages.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

-- List owners can view all messages (including hidden)
DROP POLICY IF EXISTS "List owners can view all messages" ON guest_messages;
CREATE POLICY "List owners can view all messages" ON guest_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = guest_messages.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Anyone can post messages on public lists
DROP POLICY IF EXISTS "Anyone can post messages on public lists" ON guest_messages;
CREATE POLICY "Anyone can post messages on public lists" ON guest_messages
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

-- List owners can update messages (e.g., hide)
DROP POLICY IF EXISTS "List owners can update messages" ON guest_messages;
CREATE POLICY "List owners can update messages" ON guest_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = guest_messages.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can delete messages
DROP POLICY IF EXISTS "List owners can delete messages" ON guest_messages;
CREATE POLICY "List owners can delete messages" ON guest_messages
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = guest_messages.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- RSVP Policies

-- List owners can view all RSVPs
DROP POLICY IF EXISTS "List owners can view RSVPs" ON rsvp_responses;
CREATE POLICY "List owners can view RSVPs" ON rsvp_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Anyone can submit RSVP on public lists
DROP POLICY IF EXISTS "Anyone can submit RSVP on public lists" ON rsvp_responses;
CREATE POLICY "Anyone can submit RSVP on public lists" ON rsvp_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

-- Guests can update their own RSVP (by email match - simplified)
DROP POLICY IF EXISTS "Anyone can update RSVP on public lists" ON rsvp_responses;
CREATE POLICY "Anyone can update RSVP on public lists" ON rsvp_responses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = rsvp_responses.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

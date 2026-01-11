-- Migration: Envelopes and Guests Tables
-- Description: Create tables for guest management with family grouping
-- Date: 2026-01-10

-- ============================================================================
-- STEP 1: Create envelopes table (Family/Group Invites)
-- ============================================================================

CREATE TABLE IF NOT EXISTS envelopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_list_id UUID NOT NULL REFERENCES wedding_lists(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  send_status TEXT DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE envelopes IS 'Grupos/Famílias para convites de casamento';
COMMENT ON COLUMN envelopes.group_name IS 'Nome do grupo (ex: Família Silva)';
COMMENT ON COLUMN envelopes.slug IS 'Slug único para link de convite personalizado';
COMMENT ON COLUMN envelopes.send_status IS 'Status do envio: pending, sent, failed';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_envelopes_wedding_list_id ON envelopes(wedding_list_id);
CREATE INDEX IF NOT EXISTS idx_envelopes_slug ON envelopes(slug);
CREATE INDEX IF NOT EXISTS idx_envelopes_send_status ON envelopes(send_status);

-- ============================================================================
-- STEP 2: Create guests table (Individual People)
-- ============================================================================

CREATE TABLE IF NOT EXISTS guests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  envelope_id UUID NOT NULL REFERENCES envelopes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  whatsapp TEXT,
  guest_type TEXT DEFAULT 'adult' CHECK (guest_type IN ('adult', 'child')),
  has_logged_in BOOLEAN DEFAULT false,
  has_purchased_gift BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE guests IS 'Convidados individuais vinculados a um envelope/grupo';
COMMENT ON COLUMN guests.name IS 'Nome completo do convidado';
COMMENT ON COLUMN guests.whatsapp IS 'Número de WhatsApp para disparo';
COMMENT ON COLUMN guests.guest_type IS 'Tipo: adult ou child';
COMMENT ON COLUMN guests.has_logged_in IS 'Se já acessou o convite';
COMMENT ON COLUMN guests.has_purchased_gift IS 'Se já comprou algum presente';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_guests_envelope_id ON guests(envelope_id);
CREATE INDEX IF NOT EXISTS idx_guests_whatsapp ON guests(whatsapp) WHERE whatsapp IS NOT NULL;

-- ============================================================================
-- STEP 3: Enable RLS and create policies
-- ============================================================================

-- Enable RLS
ALTER TABLE envelopes ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Envelope Policies
-- ============================================================================

-- List owners can view their envelopes
DROP POLICY IF EXISTS "List owners can view envelopes" ON envelopes;
CREATE POLICY "List owners can view envelopes" ON envelopes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = envelopes.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can create envelopes
DROP POLICY IF EXISTS "List owners can create envelopes" ON envelopes;
CREATE POLICY "List owners can create envelopes" ON envelopes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can update their envelopes
DROP POLICY IF EXISTS "List owners can update envelopes" ON envelopes;
CREATE POLICY "List owners can update envelopes" ON envelopes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = envelopes.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can delete their envelopes
DROP POLICY IF EXISTS "List owners can delete envelopes" ON envelopes;
CREATE POLICY "List owners can delete envelopes" ON envelopes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = envelopes.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Public can view envelopes by slug (for invite links)
DROP POLICY IF EXISTS "Public can view envelopes by slug" ON envelopes;
CREATE POLICY "Public can view envelopes by slug" ON envelopes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = envelopes.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

-- ============================================================================
-- Guest Policies
-- ============================================================================

-- List owners can view guests in their envelopes
DROP POLICY IF EXISTS "List owners can view guests" ON guests;
CREATE POLICY "List owners can view guests" ON guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = guests.envelope_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can create guests
DROP POLICY IF EXISTS "List owners can create guests" ON guests;
CREATE POLICY "List owners can create guests" ON guests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = envelope_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can update guests
DROP POLICY IF EXISTS "List owners can update guests" ON guests;
CREATE POLICY "List owners can update guests" ON guests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = guests.envelope_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- List owners can delete guests
DROP POLICY IF EXISTS "List owners can delete guests" ON guests;
CREATE POLICY "List owners can delete guests" ON guests
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = guests.envelope_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Public can view guests from public lists (for invite pages)
DROP POLICY IF EXISTS "Public can view guests from public envelopes" ON guests;
CREATE POLICY "Public can view guests from public envelopes" ON guests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM envelopes
      JOIN wedding_lists ON wedding_lists.id = envelopes.wedding_list_id
      WHERE envelopes.id = guests.envelope_id 
      AND wedding_lists.is_public = true
    )
  );

-- ============================================================================
-- STEP 4: Create trigger for updated_at on envelopes
-- ============================================================================

CREATE OR REPLACE FUNCTION update_envelope_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_envelope_timestamp ON envelopes;
CREATE TRIGGER update_envelope_timestamp
  BEFORE UPDATE ON envelopes
  FOR EACH ROW
  EXECUTE FUNCTION update_envelope_updated_at();

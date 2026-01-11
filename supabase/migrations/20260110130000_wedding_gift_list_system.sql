-- Migration: Wedding Gift List System Setup
-- Description: Creates the complete database schema for a multi-user wedding gift list system
-- Date: 2026-01-10

-- ============================================================================
-- STEP 1: Update profiles table with registration fields
-- ============================================================================

-- Add new columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS whatsapp TEXT,
ADD COLUMN IF NOT EXISTS cpf TEXT,
ADD COLUMN IF NOT EXISTS birth_date DATE,
ADD COLUMN IF NOT EXISTS registration_step INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS state TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS address TEXT,
ADD COLUMN IF NOT EXISTS complement TEXT;

-- Add comments for documentation
COMMENT ON COLUMN profiles.full_name IS 'Nome completo do usuário';
COMMENT ON COLUMN profiles.whatsapp IS 'Número do WhatsApp com formatação';
COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário (apenas números)';
COMMENT ON COLUMN profiles.birth_date IS 'Data de nascimento';
COMMENT ON COLUMN profiles.registration_step IS 'Etapa do cadastro (1 ou 2)';
COMMENT ON COLUMN profiles.state IS 'Estado (UF)';
COMMENT ON COLUMN profiles.city IS 'Cidade';
COMMENT ON COLUMN profiles.address IS 'Endereço completo';
COMMENT ON COLUMN profiles.complement IS 'Complemento do endereço';

-- ============================================================================
-- STEP 2: Create wedding_lists table
-- ============================================================================

CREATE TABLE IF NOT EXISTS wedding_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bride_name TEXT NOT NULL,
  groom_name TEXT NOT NULL,
  wedding_date DATE,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE wedding_lists IS 'Lista de presentes de casamento de cada usuário';
COMMENT ON COLUMN wedding_lists.slug IS 'URL amigável para compartilhar (ex: joao-maria)';
COMMENT ON COLUMN wedding_lists.is_public IS 'Se true, a lista pode ser vista publicamente';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_wedding_lists_user_id ON wedding_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_wedding_lists_slug ON wedding_lists(slug);

-- ============================================================================
-- STEP 3: Create gifts table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wedding_list_id UUID NOT NULL REFERENCES wedding_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  quantity_total INTEGER NOT NULL DEFAULT 1,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  quantity_purchased INTEGER NOT NULL DEFAULT 0,
  category TEXT,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  store_link TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE gifts IS 'Presentes da lista de casamento';
COMMENT ON COLUMN gifts.quantity_total IS 'Quantidade total disponível';
COMMENT ON COLUMN gifts.quantity_reserved IS 'Quantidade reservada por convidados';
COMMENT ON COLUMN gifts.quantity_purchased IS 'Quantidade já comprada';
COMMENT ON COLUMN gifts.priority IS 'Prioridade: high, medium, low';
COMMENT ON COLUMN gifts.store_link IS 'Link opcional para onde comprar';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gifts_wedding_list_id ON gifts(wedding_list_id);
CREATE INDEX IF NOT EXISTS idx_gifts_category ON gifts(category);

-- ============================================================================
-- STEP 4: Create gift_reservations table
-- ============================================================================

CREATE TABLE IF NOT EXISTS gift_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_id UUID NOT NULL REFERENCES gifts(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT NOT NULL,
  guest_phone TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT DEFAULT 'reserved' CHECK (status IN ('reserved', 'purchased', 'cancelled')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE gift_reservations IS 'Reservas de presentes feitas por convidados';
COMMENT ON COLUMN gift_reservations.status IS 'Status: reserved, purchased, cancelled';
COMMENT ON COLUMN gift_reservations.message IS 'Mensagem opcional do convidado para os noivos';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_gift_reservations_gift_id ON gift_reservations(gift_id);
CREATE INDEX IF NOT EXISTS idx_gift_reservations_guest_email ON gift_reservations(guest_email);

-- ============================================================================
-- STEP 5: Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE wedding_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE gifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE gift_reservations ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only view/edit their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Wedding Lists: Users can manage their own lists, anyone can view public lists
DROP POLICY IF EXISTS "Users can view own wedding lists" ON wedding_lists;
CREATE POLICY "Users can view own wedding lists" ON wedding_lists
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can view public wedding lists" ON wedding_lists;
CREATE POLICY "Anyone can view public wedding lists" ON wedding_lists
  FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Users can insert own wedding lists" ON wedding_lists;
CREATE POLICY "Users can insert own wedding lists" ON wedding_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own wedding lists" ON wedding_lists;
CREATE POLICY "Users can update own wedding lists" ON wedding_lists
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own wedding lists" ON wedding_lists;
CREATE POLICY "Users can delete own wedding lists" ON wedding_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Gifts: Users can manage gifts in their lists, anyone can view gifts from public lists
DROP POLICY IF EXISTS "Users can view gifts from own lists" ON gifts;
CREATE POLICY "Users can view gifts from own lists" ON gifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view gifts from public lists" ON gifts;
CREATE POLICY "Anyone can view gifts from public lists" ON gifts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "Users can insert gifts to own lists" ON gifts;
CREATE POLICY "Users can insert gifts to own lists" ON gifts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update gifts in own lists" ON gifts;
CREATE POLICY "Users can update gifts in own lists" ON gifts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete gifts from own lists" ON gifts;
CREATE POLICY "Users can delete gifts from own lists" ON gifts
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM wedding_lists 
      WHERE wedding_lists.id = gifts.wedding_list_id 
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- Gift Reservations: List owners can view all reservations, guests can view their own
DROP POLICY IF EXISTS "List owners can view reservations" ON gift_reservations;
CREATE POLICY "List owners can view reservations" ON gift_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Anyone can view public list reservations" ON gift_reservations;
CREATE POLICY "Anyone can view public list reservations" ON gift_reservations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "Anyone can create reservations on public lists" ON gift_reservations;
CREATE POLICY "Anyone can create reservations on public lists" ON gift_reservations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.is_public = true
    )
  );

DROP POLICY IF EXISTS "List owners can update reservations" ON gift_reservations;
CREATE POLICY "List owners can update reservations" ON gift_reservations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM gifts
      JOIN wedding_lists ON wedding_lists.id = gifts.wedding_list_id
      WHERE gifts.id = gift_reservations.gift_id
      AND wedding_lists.user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 6: Triggers for updated_at timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to wedding_lists
DROP TRIGGER IF EXISTS update_wedding_lists_updated_at ON wedding_lists;
CREATE TRIGGER update_wedding_lists_updated_at
  BEFORE UPDATE ON wedding_lists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to gifts
DROP TRIGGER IF EXISTS update_gifts_updated_at ON gifts;
CREATE TRIGGER update_gifts_updated_at
  BEFORE UPDATE ON gifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to gift_reservations
DROP TRIGGER IF EXISTS update_gift_reservations_updated_at ON gift_reservations;
CREATE TRIGGER update_gift_reservations_updated_at
  BEFORE UPDATE ON gift_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- STEP 7: Function to update gift quantities when reservation is made
-- ============================================================================

CREATE OR REPLACE FUNCTION update_gift_quantities()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment reserved count
    UPDATE gifts 
    SET quantity_reserved = quantity_reserved + NEW.quantity
    WHERE id = NEW.gift_id;
    
    -- If status is purchased, also increment purchased count
    IF NEW.status = 'purchased' THEN
      UPDATE gifts 
      SET quantity_purchased = quantity_purchased + NEW.quantity
      WHERE id = NEW.gift_id;
    END IF;
    
  ELSIF TG_OP = 'UPDATE' THEN
    -- Handle status changes
    IF OLD.status != NEW.status THEN
      IF NEW.status = 'purchased' AND OLD.status = 'reserved' THEN
        UPDATE gifts 
        SET quantity_purchased = quantity_purchased + NEW.quantity
        WHERE id = NEW.gift_id;
      ELSIF NEW.status = 'cancelled' THEN
        UPDATE gifts 
        SET quantity_reserved = quantity_reserved - OLD.quantity
        WHERE id = NEW.gift_id;
        
        IF OLD.status = 'purchased' THEN
          UPDATE gifts 
          SET quantity_purchased = quantity_purchased - OLD.quantity
          WHERE id = NEW.gift_id;
        END IF;
      END IF;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement counts when reservation is deleted
    UPDATE gifts 
    SET quantity_reserved = quantity_reserved - OLD.quantity
    WHERE id = OLD.gift_id;
    
    IF OLD.status = 'purchased' THEN
      UPDATE gifts 
      SET quantity_purchased = quantity_purchased - OLD.quantity
      WHERE id = OLD.gift_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger
DROP TRIGGER IF EXISTS update_gift_quantities_trigger ON gift_reservations;
CREATE TRIGGER update_gift_quantities_trigger
  AFTER INSERT OR UPDATE OR DELETE ON gift_reservations
  FOR EACH ROW
  EXECUTE FUNCTION update_gift_quantities();

-- Migration: Add missing columns to gift_reservations table
-- Description: Adds payment_id, payment_confirmed_at, and total_price columns
-- needed for the gift payment flow
-- Date: 2026-01-19

-- Add payment tracking columns to gift_reservations
ALTER TABLE gift_reservations
ADD COLUMN IF NOT EXISTS payment_id TEXT,
ADD COLUMN IF NOT EXISTS payment_confirmed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2);

-- Add comments for documentation
COMMENT ON COLUMN gift_reservations.payment_id IS 'ID do pagamento no Asaas';
COMMENT ON COLUMN gift_reservations.payment_confirmed_at IS 'Data/hora em que o pagamento foi confirmado';
COMMENT ON COLUMN gift_reservations.total_price IS 'Valor total pago pelo presente';

-- Create index for payment lookups
CREATE INDEX IF NOT EXISTS idx_gift_reservations_payment_id ON gift_reservations(payment_id);

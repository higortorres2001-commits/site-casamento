-- Add PIX key fields to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS pix_key_type TEXT CHECK (pix_key_type IN ('telefone', 'cpf', 'email', 'random')),
ADD COLUMN IF NOT EXISTS pix_key_value TEXT;

-- Add comments
COMMENT ON COLUMN profiles.pix_key_type IS 'Tipo da chave PIX (telefone, cpf, email, aleatória)';
COMMENT ON COLUMN profiles.pix_key_value IS 'Valor da chave PIX';

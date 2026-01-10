-- Migration: Add Kit (Bundle) product support
-- Description: Adds is_kit, kit_product_ids and kit_original_value fields to products table

-- Add is_kit column (boolean, default false)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS is_kit BOOLEAN DEFAULT FALSE;

-- Add kit_product_ids column (array of product UUIDs)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS kit_product_ids UUID[] DEFAULT NULL;

-- Add kit_original_value column (decimal for displaying savings in checkout)
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS kit_original_value DECIMAL(10,2) DEFAULT NULL;

-- Add comments for documentation
COMMENT ON COLUMN products.is_kit IS 'Se true, este produto é um kit/bundle composto por outros produtos';
COMMENT ON COLUMN products.kit_product_ids IS 'Array de IDs dos produtos que compõem este kit';
COMMENT ON COLUMN products.kit_original_value IS 'Soma dos preços individuais dos produtos do kit (para exibir economia no checkout)';

-- Create index for is_kit queries
CREATE INDEX IF NOT EXISTS idx_products_is_kit ON products(is_kit) WHERE is_kit = true;

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percentage" | "fixed";
  value: number;
  active: boolean;
  created_at: string;
};

export type Product = {
  id: string;
  created_at: string;
  user_id: string;
  name: string;
  price: number;
  description: string | null;
  memberareaurl: string | null;
  orderbumps: string[] | null;
  image_url: string | null; // Adicionado o campo image_url
};

export type ProductAsset = {
  id: string;
  product_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  signed_url?: string | null; // Adicionado para armazenar a URL assinada
};

export type Profile = {
  id: string;
  name?: string | null;
  cpf?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  access?: string[] | null;
  created_at?: string;
  updated_at?: string;
  primeiro_acesso?: boolean | null;
  has_changed_password?: boolean | null;
};

// Novo tipo para dados de tokenização de cartão de crédito
export type CreditCardTokenData = {
  creditCardToken: string;
  holderName: string;
};
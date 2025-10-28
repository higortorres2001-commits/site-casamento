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
};

export type ProductAsset = {
  id: string;
  product_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
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
};
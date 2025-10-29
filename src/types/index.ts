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

export type MetaTrackingData = {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbp?: string;
  fbc?: string;
  event_source_url?: string;
  client_ip_address?: string;
  client_user_agent?: string;
};

export type Order = {
  id: string;
  created_at: string;
  user_id: string;
  ordered_product_ids: string[];
  total_price: number;
  status: 'pending' | 'paid' | 'refunded' | 'cancelled';
  asaas_payment_id: string | null;
  meta_tracking_data: MetaTrackingData | null; // Adicionado para rastreamento do Meta Ads
};
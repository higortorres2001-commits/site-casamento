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
  image_url: string | null;
  status: 'draft' | 'ativo' | 'inativo';
  internal_tag?: string | null;
  checkout_return_url?: string | null;
  also_buy?: boolean;
  is_kit?: boolean;
  kit_product_ids?: string[] | null;
  kit_original_value?: number | null;
};

export type ProductAsset = {
  id: string;
  product_id: string;
  file_name: string;
  storage_path: string;
  created_at: string;
  signed_url?: string | null;
};

// Updated Profile type for wedding gift list system
export type Profile = {
  id: string;
  full_name?: string | null;
  cpf?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  birth_date?: string | null;
  registration_step?: number;
  // Address fields
  state?: string | null;
  city?: string | null;
  address?: string | null;
  complement?: string | null;
  // PIX key fields
  pix_key_type?: 'telefone' | 'cpf' | 'email' | 'random' | null;
  pix_key_value?: string | null;
  // Legacy fields (keeping for compatibility)
  name?: string | null;
  access?: string[] | null;
  created_at?: string;
  updated_at?: string;
  primeiro_acesso?: boolean | null;
  has_changed_password?: boolean | null;
};

// Wedding List types
export type WeddingList = {
  id: string;
  user_id: string;
  bride_name: string;
  groom_name: string;
  wedding_date?: string | null;
  slug: string;
  description?: string | null;
  is_public: boolean;
  rsvp_mode?: 'closed' | 'open';
  created_at: string;
  updated_at: string;
  // Personalization
  ceremony_location_name?: string | null;
  ceremony_address?: string | null;
  ceremony_image?: string | null;
  ceremony_time?: string | null; // HH:MM

  has_party?: boolean;
  party_date?: string | null; // ISO string
  party_time?: string | null; // HH:MM
  party_location_name?: string | null;
  party_address?: string | null;
  party_image?: string | null;

  couple_profile_image?: string | null;
  cover_image_mobile?: string | null;
  cover_image_desktop?: string | null;
  gallery_images?: string[] | null;
  couple_story?: string | null;
  brand_color?: string | null;
  dress_code?: string | null;
};

export type Gift = {
  id: string;
  wedding_list_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  quantity_total: number;
  quantity_reserved: number;
  quantity_purchased: number;
  category?: string | null;
  priority: 'high' | 'medium' | 'low';
  is_quota?: boolean;
  created_at: string;
  updated_at: string;
};

export type GiftReservation = {
  id: string;
  gift_id: string;
  guest_name: string;
  guest_email: string;
  guest_phone?: string | null;
  quantity: number;
  status: 'reserved' | 'purchased' | 'cancelled';
  message?: string | null;
  created_at: string;
  updated_at: string;
};

export type GuestMessage = {
  id: string;
  wedding_list_id: string;
  guest_name: string;
  message: string;
  photo_url?: string | null;
  is_visible: boolean;
  created_at: string;
};

export type RSVPResponse = {
  id: string;
  wedding_list_id: string;
  guest_name: string;
  guest_email?: string | null;
  guest_phone?: string | null;
  attending: 'yes' | 'no' | 'maybe';
  companions: number;
  dietary_restrictions?: string | null;
  message?: string | null;
  created_at: string;
};

// Envelope types (Family/Group Invites)
export type Envelope = {
  id: string;
  wedding_list_id: string;
  group_name: string;
  slug: string;
  send_status: 'pending' | 'sent' | 'failed';
  source?: 'manual' | 'public';
  created_at: string;
  updated_at: string;
  guests?: Guest[]; // For joined queries
};

// Guest types (Individual People)
export type Guest = {
  id: string;
  envelope_id: string;
  name: string;
  whatsapp?: string | null;
  guest_type: 'adult' | 'child';
  has_logged_in: boolean;
  has_purchased_gift: boolean;
  created_at: string;
};
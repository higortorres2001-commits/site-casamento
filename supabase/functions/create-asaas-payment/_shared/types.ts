export interface RequestPayload {
  name: string;
  email: string;
  cpf: string;
  whatsapp: string;
  productIds: string[];
  coupon_code?: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  creditCard?: any;
  metaTrackingData?: any;
}

export interface UserData {
  id: string;
  isExisting: boolean;
}

export interface ProductData {
  id: string;
  name: string;
  price: number;
  status: string;
}

export interface OrderData {
  id: string;
  user_id: string;
  total_price: number;
  status: string;
}

export interface CouponData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}
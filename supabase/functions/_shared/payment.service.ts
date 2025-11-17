import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface PaymentResult {
  id: string;
  orderId: string;
  status: string;
  payload?: string;
  encodedImage?: string;
}

export interface AsaasCustomer {
  id: string;
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
}

/**
 * Busca cliente existente no Asaas por email
 */
async function findAsaasCustomer(email: string): Promise<AsaasCustomer | null> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    throw new Error('Configuração de pagamento não encontrada');
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const response = await fetch(
    `${ASAAS_BASE_URL}/customers?email=${encodeURIComponent(email)}`,
    { method: 'GET', headers }
  );

  if (!response.ok) {
    throw new Error(`Erro ao buscar cliente no Asaas: ${response.statusText}`);
  }

  const data = await response.json();
  
  // A API retorna um array de clientes
  if (data.data && data.data.length > 0) {
    return data.data[0]; // Retorna o primeiro cliente encontrado
  }

  return null;
}

/**
 * Cria novo cliente no Asaas
 */
async function createAsaasCustomer(customerData: {
  name: string;
  email: string;
  cpf: string;
  whatsapp: string;
}): Promise<AsaasCustomer> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    throw new Error('Configuração de pagamento não encontrada');
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const payload = {
    name: customerData.name,
    email: customerData.email,
    cpfCnpj: customerData.cpf,
    phone: customerData.whatsapp,
    mobilePhone: customerData.whatsapp,
    notificationDisabled: false,
  };

  const response = await fetch(`${ASAAS_BASE_URL}/customers`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Erro ao criar cliente no Asaas: ${errorData.errors?.[0]?.description || response.statusText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Busca ou cria cliente no Asaas (idempotente)
 */
async function getOrCreateAsaasCustomer(customerData: {
  name: string;
  email: string;
  cpf: string;
  whatsapp: string;
}): Promise<AsaasCustomer> {
  // Primeiro, tentar buscar cliente existente
  const existingCustomer = await findAsaasCustomer(customerData.email);
  
  if (existingCustomer) {
    console.log('Asaas customer found:', existingCustomer.id);
    return existingCustomer;
  }

  // Se não existir, criar novo cliente
  console.log('Creating new Asaas customer for:', customerData.email);
  const newCustomer = await createAsaasCustomer(customerData);
  console.log('Asaas customer created:', newCustomer.id);
  
  return newCustomer;
}

/**
 * Cria pagamento PIX no Asaas
 */
export async function createPixPayment(
  orderId: string,
  customerData: {
    name: string;
    email: string;
    cpf: string;
    whatsapp: string;
  },
  totalPrice: number
): Promise<PaymentResult> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    throw new Error('Configuração de pagamento não encontrada');
  }

  // ETAPA 1: Buscar ou criar cliente no Asaas
  const asaasCustomer = await getOrCreateAsaasCustomer(customerData);

  // ETAPA 2: Criar pagamento usando o ID do cliente
  const asaasPayload = {
    customer: asaasCustomer.id, // ✅ Usar ID do cliente, não o email
    value: parseFloat(totalPrice.toFixed(2)),
    description: `Pedido #${orderId.substring(0, 8)}`,
    externalReference: orderId,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    billingType: 'PIX',
  };

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(asaasPayload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Asaas API error: ${errorData.errors?.[0]?.description || response.statusText}`);
  }

  const paymentData = await response.json();

  // ETAPA 3: Buscar QR Code
  const qrCodeResponse = await fetch(
    `${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`,
    { method: 'GET', headers }
  );

  if (!qrCodeResponse.ok) {
    throw new Error('Erro ao gerar QR Code PIX');
  }

  const qrCodeData = await qrCodeResponse.json();

  return {
    id: paymentData.id,
    orderId,
    status: paymentData.status,
    payload: qrCodeData.payload,
    encodedImage: qrCodeData.encodedImage,
  };
}

/**
 * Cria pagamento com cartão de crédito no Asaas
 */
export async function createCreditCardPayment(
  orderId: string,
  customerData: {
    name: string;
    email: string;
    cpf: string;
    whatsapp: string;
  },
  creditCardData: {
    holderName: string;
    cardNumber: string;
    expiryMonth: string;
    expiryYear: string;
    ccv: string;
    postalCode: string;
    addressNumber: string;
    installmentCount?: number;
  },
  totalPrice: number,
  clientIp: string
): Promise<PaymentResult> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    throw new Error('Configuração de pagamento não encontrada');
  }

  // ETAPA 1: Buscar ou criar cliente no Asaas
  const asaasCustomer = await getOrCreateAsaasCustomer(customerData);

  // ETAPA 2: Criar pagamento usando o ID do cliente
  const asaasPayload: any = {
    customer: asaasCustomer.id, // ✅ Usar ID do cliente, não o email
    value: parseFloat(totalPrice.toFixed(2)),
    description: `Pedido #${orderId.substring(0, 8)}`,
    externalReference: orderId,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    billingType: 'CREDIT_CARD',
    creditCard: {
      holderName: creditCardData.holderName,
      number: creditCardData.cardNumber.replace(/\s/g, ''),
      expiryMonth: creditCardData.expiryMonth,
      expiryYear: creditCardData.expiryYear,
      ccv: creditCardData.ccv,
    },
    creditCardHolderInfo: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
      postalCode: creditCardData.postalCode.replace(/\D/g, ''),
      addressNumber: creditCardData.addressNumber,
    },
    remoteIp: clientIp,
  };

  if (creditCardData.installmentCount && creditCardData.installmentCount > 1) {
    asaasPayload.installmentCount = creditCardData.installmentCount;
    asaasPayload.installmentValue = parseFloat((totalPrice / creditCardData.installmentCount).toFixed(2));
  }

  const headers = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(asaasPayload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Asaas API error: ${errorData.errors?.[0]?.description || response.statusText}`);
  }

  const paymentData = await response.json();

  return {
    id: paymentData.id,
    orderId,
    status: paymentData.status,
  };
}

/**
 * Verifica status de pagamento no Asaas
 */
export async function checkPaymentStatus(paymentId: string): Promise<string> {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    throw new Error('Configuração de pagamento não encontrada');
  }

  const response = await fetch(`${ASAAS_BASE_URL}/payments/${paymentId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    }
  });

  if (!response.ok) {
    throw new Error('Erro ao verificar status do pagamento');
  }

  const data = await response.json();
  return data.status;
}
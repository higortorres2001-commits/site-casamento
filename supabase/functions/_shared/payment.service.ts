import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface PaymentResult {
  id: string;
  orderId: string;
  status: string;
  payload?: string;
  encodedImage?: string;
}

/**
 * Cria pagamento PIX no Asaas
 * Usa criação inline de cliente para evitar duplicatas e simplificar o fluxo
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

  // Limpar dados do cliente
  const cleanCpf = customerData.cpf.replace(/\D/g, '');
  const cleanPhone = customerData.whatsapp.replace(/\D/g, '');
  
  // ✅ FORMATO CORRETO: Enviar customer como objeto
  const asaasPayload = {
    customer: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: cleanCpf,
      phone: cleanPhone,
    },
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

  console.log('Creating PIX payment with payload:', JSON.stringify(asaasPayload, null, 2));

  // Criar pagamento
  const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(asaasPayload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Asaas API error response:', errorData);
    throw new Error(`Erro ao criar pagamento: ${errorData.errors?.[0]?.description || response.statusText}`);
  }

  const paymentData = await response.json();
  console.log('PIX payment created successfully:', paymentData.id);

  // Buscar QR Code
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
 * Usa criação inline de cliente para evitar duplicatas e simplificar o fluxo
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

  // Limpar dados do cliente
  const cleanCpf = customerData.cpf.replace(/\D/g, '');
  const cleanPhone = customerData.whatsapp.replace(/\D/g, '');
  
  // ✅ FORMATO CORRETO: Enviar customer como objeto
  const asaasPayload: any = {
    customer: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: cleanCpf,
      phone: cleanPhone,
    },
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
      cpfCnpj: cleanCpf,
      phone: cleanPhone,
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

  console.log('Creating credit card payment with payload:', JSON.stringify(asaasPayload, null, 2));

  const response = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers,
    body: JSON.stringify(asaasPayload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    console.error('Asaas API error response:', errorData);
    throw new Error(`Erro ao criar pagamento: ${errorData.errors?.[0]?.description || response.statusText}`);
  }

  const paymentData = await response.json();
  console.log('Credit card payment created successfully:', paymentData.id);

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
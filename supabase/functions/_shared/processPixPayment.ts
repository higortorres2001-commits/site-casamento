import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ProcessPixPaymentInput {
  supabase: any;
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  value: number;
  description: string;
  dueDate?: string;
}

interface ProcessPixPaymentOutput {
  paymentData: any;
  paymentId: string;
  qrCodeData?: any;
}

export async function processPixPayment({
  supabase,
  name,
  email,
  cpfCnpj,
  phone,
  value,
  description,
  dueDate
}: ProcessPixPaymentInput): Promise<ProcessPixPaymentOutput> {
  console.log('🔵 processPixPayment - Starting PIX payment processing', {
    name,
    email,
    cpfCnpj,
    phone,
    value,
    description
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    console.error('❌ ASAAS credentials not configured');
    await supabase.from('logs').insert({
      level: 'error',
      context: 'processPixPayment-config',
      message: 'ASAAS credentials not configured',
      metadata: { 
        hasApiKey: !!ASAAS_API_KEY,
        hasBaseUrl: !!ASAAS_BASE_URL
      }
    });
    throw new Error('ASAAS credentials not configured');
  }

  // ETAPA 1: Criar pagamento PIX no Asaas
  console.log('🚀 Creating PIX payment with Asaas');
  
  const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments`;
  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const asaasPayload = {
    customer: {
      name: name,
      email: email.toLowerCase().trim(),
      cpfCnpj: cpfCnpj,
      phone: phone,
    },
    value: parseFloat(value.toFixed(2)),
    description: description,
    billingType: 'PIX',
    dueDate: dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0], // +24h
  };

  console.log('📤 Sending to Asaas:', {
    url: asaasPaymentsUrl,
    payload: {
      ...asaasPayload,
      customer: {
        name: asaasPayload.customer.name,
        email: asaasPayload.customer.email,
        hasCpfCnpj: !!asaasPayload.customer.cpfCnpj,
        hasPhone: !!asaasPayload.customer.phone
      },
      value: asaasPayload.value,
      billingType: asaasPayload.billingType
    }
  });

  const asaasResponse = await fetch(asaasPaymentsUrl, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify(asaasPayload)
  });

  if (!asaasResponse.ok) {
    const errorData = await asaasResponse.json();
    console.error('❌ Asaas PIX error:', errorData);
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'processPixPayment-asaas-error',
      message: 'Failed to create PIX payment',
      metadata: { 
        asaasPayload: {
          ...asaasPayload,
          customer: { name: asaasPayload.customer.name, email: asaasPayload.customer.email }
        },
        asaasError: errorData,
        httpStatus: asaasResponse.status,
        httpStatusText: asaasResponse.statusText
      }
    });
    throw new Error(`Failed to create PIX payment: ${JSON.stringify(errorData)}`);
  }

  const paymentData = await asaasResponse.json();
  const paymentId = paymentData.id;

  console.log('✅ PIX payment created successfully:', {
    paymentId,
    status: paymentData.status
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'processPixPayment-asaas-success',
    message: 'PIX payment created successfully',
    metadata: { 
      paymentId,
      asaasResponse: {
        id: paymentData.id,
        status: paymentData.status
      }
    }
  });

  // ETAPA 2: Buscar QR Code do PIX
  console.log('📱 Fetching PIX QR Code');
  
  const pixQrCodeUrl = `${ASAAS_BASE_URL}/payments/${paymentId}/pixQrCode`;
  
  const pixQrCodeResponse = await fetch(pixQrCodeUrl, {
    method: 'GET',
    headers: asaasHeaders
  });

  if (!pixQrCodeResponse.ok) {
    const errorData = await pixQrCodeResponse.json();
    console.error('❌ Asaas PIX QR Code error:', errorData);
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'processPixPayment-qrCode-error',
      message: 'Failed to fetch PIX QR Code',
      metadata: { 
        paymentId, 
        asaasError: errorData,
        httpStatus: pixQrCodeResponse.status
      }
    });
    throw new Error(`Failed to fetch PIX QR Code: ${JSON.stringify(errorData)}`);
  }

  const qrCodeData = await pixQrCodeResponse.json();
  
  console.log('✅ PIX QR Code fetched successfully:', {
    paymentId,
    hasPayload: !!qrCodeData.payload,
    hasEncodedImage: !!qrCodeData.encodedImage
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'processPixPayment-qrCode-success',
    message: 'PIX QR Code fetched successfully',
    metadata: { 
      paymentId,
      hasPayload: !!qrCodeData.payload,
      hasEncodedImage: !!qrCodeData.encodedImage
    }
  });

  return {
    paymentData,
    paymentId,
    qrCodeData
  };
}
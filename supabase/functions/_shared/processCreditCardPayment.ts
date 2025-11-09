import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface ProcessCreditCardPaymentInput {
  supabase: any;
  name: string;
  email: string;
  cpfCnpj: string;
  phone: string;
  postalCode: string;
  addressNumber: string;
  value: number;
  description: string;
  holderName: string;
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  ccv: string;
  installmentCount?: number;
  installmentValue?: number;
  remoteIp?: string;
}

interface ProcessCreditCardPaymentOutput {
  paymentData: any;
  paymentId: string;
}

export async function processCreditCardPayment({
  supabase,
  name,
  email,
  cpfCnpj,
  phone,
  postalCode,
  addressNumber,
  value,
  description,
  holderName,
  cardNumber,
  expiryMonth,
  expiryYear,
  ccv,
  installmentCount,
  installmentValue,
  remoteIp
}: ProcessCreditCardPaymentInput): Promise<ProcessCreditCardPaymentOutput> {
  console.log('💳 processCreditCardPayment - Starting credit card payment processing', {
    name,
    email,
    cpfCnpj,
    phone,
    value,
    holderName,
    installmentCount,
    installmentValue
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    console.error('❌ ASAAS credentials not configured');
    await supabase.from('logs').insert({
      level: 'error',
      context: 'processCreditCardPayment-config',
      message: 'ASAAS credentials not configured',
      metadata: { 
        hasApiKey: !!ASAAS_API_KEY,
        hasBaseUrl: !!ASAAS_BASE_URL
      }
    });
    throw new Error('ASAAS credentials not configured');
  }

  // ETAPA 1: Criar pagamento com cartão no Asaas
  console.log('🚀 Creating credit card payment with Asaas');
  
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
    billingType: 'CREDIT_CARD',
    creditCard: {
      holderName: holderName,
      number: cardNumber.replace(/\s/g, ''),
      expiryMonth: expiryMonth,
      expiryYear: expiryYear,
      ccv: ccv,
    },
    creditCardHolderInfo: {
      name: name,
      email: email.toLowerCase().trim(),
      cpfCnpj: cpfCnpj,
      phone: phone,
      postalCode: postalCode.replace(/\D/g, ''),
      addressNumber: addressNumber,
    },
    remoteIp: remoteIp || '127.0.0.1'
  };

  // Adicionar informações de parcelamento se houver
  if (installmentCount && installmentCount > 1) {
    asaasPayload.installmentCount = installmentCount;
    asaasPayload.installmentValue = parseFloat(installmentValue!.toFixed(2));
  }

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
      billingType: asaasPayload.billingType,
      hasInstallments: !!installmentCount,
      installmentCount: installmentCount
    }
  });

  const asaasResponse = await fetch(asaasPaymentsUrl, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify(asaasPayload)
  });

  if (!asaasResponse.ok) {
    const errorData = await asaasResponse.json();
    console.error('❌ Asaas credit card error:', errorData);
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'processCreditCardPayment-asaas-error',
      message: 'Failed to create credit card payment',
      metadata: { 
        asaasPayload: {
          ...asaasPayload,
          customer: { name: asaasPayload.customer.name, email: asaasPayload.customer.email },
          creditCard: {
            holderName: asaasPayload.creditCard.holderName,
            number: '****-****-****-' + cardNumber.slice(-4),
            expiryMonth: asaasPayload.creditCard.expiryMonth,
            expiryYear: asaasPayload.creditCard.expiryYear
          }
        },
        asaasError: errorData,
        httpStatus: asaasResponse.status,
        httpStatusText: asaasResponse.statusText
      }
    });
    throw new Error(`Failed to create credit card payment: ${JSON.stringify(errorData)}`);
  }

  const paymentData = await asaasResponse.json();
  const paymentId = paymentData.id;

  console.log('✅ Credit card payment created successfully:', {
    paymentId,
    status: paymentData.status,
    authorizationCode: paymentData.authorizationCode
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'processCreditCardPayment-asaas-success',
    message: 'Credit card payment created successfully',
    metadata: { 
      paymentId,
      status: paymentData.status,
      authorizationCode: paymentData.authorizationCode,
      hasInstallments: !!installmentCount,
      installmentCount: installmentCount
    }
  });

  return {
    paymentData,
    paymentId
  };
}
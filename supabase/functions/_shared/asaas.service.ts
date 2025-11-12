import { RequestPayload, OrderData } from './types.ts';

// Função auxiliar para atualizar pedido com ID do pagamento
export async function updateOrderWithPaymentId(orderId: string, asaasPaymentId: string, supabase: any): Promise<void> {
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ asaas_payment_id: asaasPaymentId })
    .eq('id', orderId);

  if (orderUpdateError) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'order-payment-id-update-error',
      message: 'Failed to update order with payment ID, but payment was created',
      metadata: { 
        orderId,
        asaasPaymentId,
        error: orderUpdateError.message,
        errorCode: orderUpdateError.code
      }
    });
  } else {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-payment-id-updated',
      message: 'Order updated successfully with payment ID',
      metadata: { orderId, asaasPaymentId }
    });
  }
}

// Função para processar pagamento PIX
export async function processPixPayment(order: OrderData, customerData: RequestPayload, supabase: any): Promise<any> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'pix-payment-start',
    message: 'Starting PIX payment processing with Asaas',
    metadata: { 
      orderId: order.id,
      totalPrice: order.total_price
    }
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'pix-payment-config-error',
      message: 'Asaas API credentials not configured',
      metadata: { 
        hasApiKey: !!ASAAS_API_KEY,
        hasBaseUrl: !!ASAAS_BASE_URL
      }
    });
    throw new Error('Configuração de pagamento não encontrada');
  }

  const asaasPayload = {
    customer: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
    },
    value: parseFloat(order.total_price.toFixed(2)),
    description: `Order #${order.id} payment`,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    billingType: 'PIX',
  };

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  // Criar pagamento PIX
  const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify(asaasPayload)
  });

  if (!asaasResponse.ok) {
    const errorData = await asaasResponse.json();
    await supabase.from('logs').insert({
      level: 'error',
      context: 'pix-payment-creation-error',
      message: 'Failed to create PIX payment with Asaas',
      metadata: { 
        orderId: order.id,
        asaasError: errorData,
        httpStatus: asaasResponse.status,
        httpStatusText: asaasResponse.statusText
      }
    });
    throw new Error('Erro ao criar pagamento PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const pixPaymentData = await asaasResponse.json();

  await supabase.from('logs').insert({
    level: 'info',
    context: 'pix-payment-created',
    message: 'PIX payment created successfully with Asaas',
    metadata: { 
      orderId: order.id,
      asaasPaymentId: pixPaymentData.id,
      status: pixPaymentData.status
    }
  });

  // Buscar QR Code do PIX
  const pixQrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${pixPaymentData.id}/pixQrCode`, {
    method: 'GET',
    headers: asaasHeaders
  });

  if (!pixQrCodeResponse.ok) {
    const errorData = await pixQrCodeResponse.json();
    await supabase.from('logs').insert({
      level: 'error',
      context: 'pix-qrcode-fetch-error',
      message: 'Failed to fetch PIX QR Code from Asaas',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: pixPaymentData.id,
        asaasError: errorData,
        httpStatus: pixQrCodeResponse.status
      }
    });
    throw new Error('Erro ao gerar QR Code PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const pixQrCodeData = await pixQrCodeResponse.json();

  await supabase.from('logs').insert({
    level: 'info',
    context: 'pix-qrcode-success',
    message: 'PIX QR Code fetched successfully',
    metadata: { 
      orderId: order.id,
      asaasPaymentId: pixPaymentData.id,
      hasPayload: !!pixQrCodeData.payload,
      hasEncodedImage: !!pixQrCodeData.encodedImage
    }
  });

  // Atualizar pedido com ID do pagamento
  await updateOrderWithPaymentId(order.id, pixPaymentData.id, supabase);

  return {
    id: pixPaymentData.id,
    orderId: order.id,
    payload: pixQrCodeData.payload,
    encodedImage: pixQrCodeData.encodedImage,
  };
}

// Função para processar pagamento com cartão de crédito
export async function processCreditCardPayment(order: OrderData, customerData: RequestPayload, creditCardData: any, clientIpAddress: string, supabase: any): Promise<any> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'credit-card-payment-start',
    message: 'Starting credit card payment processing with Asaas',
    metadata: { 
      orderId: order.id,
      totalPrice: order.total_price,
      installmentCount: creditCardData.installmentCount || 1
    }
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'credit-card-payment-config-error',
      message: 'Asaas API credentials not configured',
      metadata: { 
        hasApiKey: !!ASAAS_API_KEY,
        hasBaseUrl: !!ASAAS_BASE_URL
      }
    });
    throw new Error('Configuração de pagamento não encontrada');
  }

  const asaasPayload: any = {
    customer: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
    },
    value: parseFloat(order.total_price.toFixed(2)),
    description: `Order #${order.id} payment`,
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
    remoteIp: clientIpAddress,
  };

  // Adicionar parcelas se especificado
  if (creditCardData.installmentCount && creditCardData.installmentCount > 1) {
    asaasPayload.installmentCount = creditCardData.installmentCount;
    asaasPayload.installmentValue = parseFloat((order.total_price / creditCardData.installmentCount).toFixed(2));
  }

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify(asaasPayload),
  });

  if (!asaasResponse.ok) {
    const errorData = await asaasResponse.json();
    await supabase.from('logs').insert({
      level: 'error',
      context: 'credit-card-payment-creation-error',
      message: 'Failed to create credit card payment with Asaas',
      metadata: { 
        orderId: order.id,
        asaasError: errorData,
        httpStatus: asaasResponse.status,
        installmentCount: creditCardData.installmentCount || 1
      }
    });
    throw new Error('Erro ao processar pagamento com cartão: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const paymentData = await asaasResponse.json();

  await supabase.from('logs').insert({
    level: 'info',
    context: 'credit-card-payment-success',
    message: 'Credit card payment processed successfully',
    metadata: { 
      orderId: order.id,
      asaasPaymentId: paymentData.id,
      status: paymentData.status,
      authorizationCode: paymentData.authorizationCode
    }
  });

  // Atualizar pedido com ID do pagamento
  await updateOrderWithPaymentId(order.id, paymentData.id, supabase);

  return { ...paymentData, orderId: order.id };
}
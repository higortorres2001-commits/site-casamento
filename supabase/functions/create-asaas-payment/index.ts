import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getOrCreateCustomer } from '../_shared/getOrCreateCustomer.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos para melhor organização
interface RequestPayload {
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

interface ProductData {
  id: string;
  name: string;
  price: number;
  status: string;
}

interface OrderData {
  id: string;
  user_id: string;
  total_price: number;
  status: string;
}

interface CouponData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}

// Função para validar dados de entrada
async function validateRequestData(requestBody: any, supabase: any): Promise<RequestPayload> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'create-payment-validation-start',
    message: 'Starting request validation',
    metadata: { 
      hasName: !!requestBody.name,
      hasEmail: !!requestBody.email,
      hasCpf: !!requestBody.cpf,
      hasWhatsapp: !!requestBody.whatsapp,
      hasProductIds: !!requestBody.productIds,
      productIdsCount: requestBody.productIds?.length || 0,
      paymentMethod: requestBody.paymentMethod
    }
  });

  const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

  // Validação de campos obrigatórios
  const missingFields = [];
  if (!name) missingFields.push('name');
  if (!email) missingFields.push('email');
  if (!cpf) missingFields.push('cpf');
  if (!whatsapp) missingFields.push('whatsapp');
  if (!productIds || !Array.isArray(productIds) || productIds.length === 0) missingFields.push('productIds');
  if (!paymentMethod) missingFields.push('paymentMethod');

  if (missingFields.length > 0) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-payment-validation-error',
      message: 'Missing required fields in request',
      metadata: { missingFields, receivedFields: Object.keys(requestBody) }
    });
    throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
  }

  // Validação de método de pagamento
  if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-payment-validation-error',
      message: 'Invalid payment method',
      metadata: { paymentMethod, validMethods: ['PIX', 'CREDIT_CARD'] }
    });
    throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
  }

  // Validação específica para cartão de crédito
  if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-payment-validation-error',
      message: 'Credit card data missing for CREDIT_CARD payment',
      metadata: { paymentMethod, hasCreditCard: !!creditCard }
    });
    throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'create-payment-validation-success',
    message: 'Request validation completed successfully',
    metadata: { 
      email: email.toLowerCase().trim(),
      paymentMethod,
      productCount: productIds.length,
      hasCoupon: !!coupon_code
    }
  });

  return {
    name: name.trim(),
    email: email.toLowerCase().trim(),
    cpf: cpf.replace(/[^0-9]/g, ''),
    whatsapp: whatsapp.replace(/\D/g, ''),
    productIds,
    coupon_code,
    paymentMethod,
    creditCard,
    metaTrackingData
  };
}

// Função para validar produtos
async function validateProducts(productIds: string[], supabase: any): Promise<ProductData[]> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'product-validation-start',
    message: 'Starting product validation',
    metadata: { 
      requestedProductIds: productIds,
      productCount: productIds.length
    }
  });

  const uniqueProductIds = [...new Set(productIds)];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, name, status')
    .in('id', uniqueProductIds);

  if (productsError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-query-error',
      message: 'Database error while fetching products',
      metadata: { 
        requestedIds: uniqueProductIds,
        error: productsError.message,
        errorCode: productsError.code
      }
    });
    throw new Error('Erro ao buscar produtos no banco de dados: ' + productsError.message);
  }

  if (!products || products.length !== uniqueProductIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));

    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-missing-products',
      message: 'Some requested products were not found',
      metadata: { 
        requestedIds: uniqueProductIds,
        foundIds: Array.from(foundIds),
        missingIds,
        foundCount: products?.length || 0,
        requestedCount: uniqueProductIds.length
      }
    });
    throw new Error(`Produtos não encontrados: ${missingIds.join(', ')}`);
  }

  // Verificar se todos os produtos estão ativos
  const inactiveProducts = products.filter(p => p.status !== 'ativo');
  if (inactiveProducts.length > 0) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-inactive-products',
      message: 'Some requested products are not active',
      metadata: { 
        inactiveProducts: inactiveProducts.map(p => ({ id: p.id, name: p.name, status: p.status }))
      }
    });
    throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'product-validation-success',
    message: 'All products validated successfully',
    metadata: { 
      validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price, status: p.status }))
    }
  });

  return products as ProductData[];
}

// Função para aplicar cupom de desconto
async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any): Promise<{ finalTotal: number; couponData?: CouponData }> {
  if (!couponCode) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'coupon-application-skipped',
      message: 'No coupon code provided, skipping coupon validation',
      metadata: { originalTotal }
    });
    return { finalTotal: originalTotal };
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'coupon-application-start',
    message: 'Starting coupon validation and application',
    metadata: { 
      couponCode: couponCode.toUpperCase().trim(),
      originalTotal
    }
  });

  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('code, discount_type, value, active')
    .eq('code', couponCode.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (couponError || !coupon) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'coupon-application-invalid',
      message: 'Invalid or inactive coupon code provided',
      metadata: { 
        couponCode: couponCode.toUpperCase().trim(),
        error: couponError?.message,
        errorCode: couponError?.code
      }
    });
    throw new Error(`Cupom inválido ou inativo: ${couponCode}`);
  }

  let finalTotal = originalTotal;
  let discountAmount = 0;

  if (coupon.discount_type === 'percentage') {
    discountAmount = originalTotal * (parseFloat(coupon.value) / 100);
    finalTotal = originalTotal - discountAmount;
  } else if (coupon.discount_type === 'fixed') {
    discountAmount = parseFloat(coupon.value);
    finalTotal = Math.max(0, originalTotal - discountAmount);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'coupon-application-success',
    message: 'Coupon applied successfully',
    metadata: { 
      couponCode: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.value,
      originalTotal,
      discountAmount,
      finalTotal
    }
  });

  return { finalTotal, couponData: coupon as CouponData };
}

// Função para criar pedido
async function createOrder(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any): Promise<OrderData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'order-creation-start',
    message: 'Starting order creation',
    metadata: { 
      userId,
      productIds,
      totalPrice,
      productCount: productIds.length
    }
  });

  const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const clientUserAgent = req.headers.get('user-agent') || '';

  const fullMetaTrackingData = {
    ...metaTrackingData,
    client_ip_address: clientIpAddress,
    client_user_agent: clientUserAgent,
  };

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      user_id: userId,
      ordered_product_ids: productIds,
      total_price: totalPrice,
      status: 'pending',
      meta_tracking_data: fullMetaTrackingData,
    })
    .select()
    .single();

  if (orderError || !order) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'order-creation-error',
      message: 'Failed to create order in database',
      metadata: { 
        userId,
        productIds,
        totalPrice,
        error: orderError?.message,
        errorCode: orderError?.code
      }
    });
    throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'order-creation-success',
    message: 'Order created successfully',
    metadata: { 
      orderId: order.id,
      userId,
      totalPrice,
      status: order.status
    }
  });

  return order as OrderData;
}

// Função para processar pagamento PIX
async function processPixPayment(order: OrderData, customerData: RequestPayload, supabase: any): Promise<any> {
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
async function processCreditCardPayment(order: OrderData, customerData: RequestPayload, creditCardData: any, clientIpAddress: string, supabase: any): Promise<any> {
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

// Função auxiliar para atualizar pedido com ID do pagamento
async function updateOrderWithPaymentId(orderId: string, asaasPaymentId: string, supabase: any): Promise<void> {
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

// FUNÇÃO PRINCIPAL ORQUESTRADORA
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let requestBody: any;
  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-orchestrator-start',
      message: 'Payment creation orchestrator started',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        hasProductIds: !!requestBody.productIds,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code,
        userAgent: req.headers.get('user-agent')?.substring(0, 100) || 'unknown'
      }
    });

    // ETAPA 1: Validar dados de entrada
    const validatedPayload = await validateRequestData(requestBody, supabase);

    // ETAPA 2: Gerenciar usuário (usando função externa)
    const customerResult = await getOrCreateCustomer(supabase, {
      email: validatedPayload.email,
      name: validatedPayload.name,
      cpf: validatedPayload.cpf,
      whatsapp: validatedPayload.whatsapp
    });
    userId = customerResult.userId;

    // ETAPA 3: Validar produtos
    const products = await validateProducts(validatedPayload.productIds, supabase);
    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 4: Aplicar cupom (se fornecido)
    const { finalTotal, couponData } = await applyCoupon(validatedPayload.coupon_code, originalTotal, supabase);

    // ETAPA 5: Criar pedido
    const order = await createOrder(userId, validatedPayload.productIds, finalTotal, validatedPayload.metaTrackingData, req, supabase);
    orderId = order.id;

    // ETAPA 6: Processar pagamento baseado no método escolhido
    let paymentResult: any;
    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    if (validatedPayload.paymentMethod === 'PIX') {
      paymentResult = await processPixPayment(order, validatedPayload, supabase);
      asaasPaymentId = paymentResult.id;
    } else if (validatedPayload.paymentMethod === 'CREDIT_CARD') {
      paymentResult = await processCreditCardPayment(order, validatedPayload, validatedPayload.creditCard, clientIpAddress, supabase);
      asaasPaymentId = paymentResult.id;
    } else {
      throw new Error('Método de pagamento não suportado');
    }

    // ETAPA 7: Log final de sucesso
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-orchestrator-success',
      message: 'Payment creation orchestration completed successfully',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        paymentMethod: validatedPayload.paymentMethod,
        finalTotal,
        originalTotal,
        discountApplied: originalTotal - finalTotal,
        wasExistingUser: customerResult.isExisting,
        productCount: validatedPayload.productIds.length,
        couponUsed: couponData?.code || null
      }
    });

    return new Response(JSON.stringify(paymentResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-orchestrator-error',
      message: `Payment creation orchestration failed: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        paymentMethod: requestBody?.paymentMethod,
        requestBodyKeys: requestBody ? Object.keys(requestBody) : []
      }
    });

    // Retornar erro mais amigável para o usuário
    let userFriendlyMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.';
    
    if (error.message.includes('Campos obrigatórios ausentes')) {
      userFriendlyMessage = 'Dados incompletos. Verifique se todos os campos foram preenchidos.';
    } else if (error.message.includes('Método de pagamento inválido')) {
      userFriendlyMessage = 'Método de pagamento não suportado.';
    } else if (error.message.includes('Produtos não encontrados')) {
      userFriendlyMessage = 'Um ou mais produtos não estão disponíveis.';
    } else if (error.message.includes('Cupom inválido')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('Erro ao criar conta') || error.message.includes('Erro ao criar perfil')) {
      userFriendlyMessage = 'Erro ao processar seus dados. Verifique as informações e tente novamente.';
    } else if (error.message.includes('Erro ao criar pagamento') || error.message.includes('Erro ao processar pagamento')) {
      userFriendlyMessage = 'Erro no processamento do pagamento. Verifique os dados do cartão e tente novamente.';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
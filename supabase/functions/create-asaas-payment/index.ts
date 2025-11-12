import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para validar dados de entrada
async function validateRequestData(requestBody: any, supabase: any) {
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
    name,
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

// Função para gerenciar usuário (existente ou novo)
async function handleUserManagement(payload: any, supabase: any) {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-start',
    message: 'Starting user management process',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      timestamp: new Date().toISOString()
    }
  });

  // Buscar usuário existente
  const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();

  if (listUsersError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user',
      metadata: { 
        email: payload.email,
        error: listUsersError.message,
        errorType: listUsersError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente: ' + listUsersError.message);
  }

  const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === payload.email.toLowerCase());

  if (existingUser) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, updating profile',
      metadata: { 
        userId: existingUser.id,
        email: payload.email
      }
    });

    // Atualizar perfil do usuário existente
    const { error: upsertProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: existingUser.id,
        name: payload.name, 
        cpf: payload.cpf, 
        email: payload.email, 
        whatsapp: payload.whatsapp,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      });

    if (upsertProfileError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-upsert-error',
        message: 'Failed to upsert existing user profile, but continuing with payment',
        metadata: { 
          userId: existingUser.id,
          error: upsertProfileError.message
        }
      });
    }

    return { id: existingUser.id, isExisting: true };
  } else {
    // Criar novo usuário
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-creating-new',
      message: 'Creating new user account',
      metadata: { 
        email: payload.email,
        cpfLength: payload.cpf.length
      }
    });

    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.cpf,
      email_confirm: true,
      user_metadata: { 
        name: payload.name, 
        cpf: payload.cpf, 
        whatsapp: payload.whatsapp,
        created_via: 'checkout'
      },
    });

    if (createUserError || !createdUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-create-error',
        message: 'Failed to create new user',
        metadata: { 
          email: payload.email,
          error: createUserError?.message
        }
      });
      throw new Error('Erro ao criar usuário: ' + (createUserError?.message || 'Erro desconhecido'));
    }

    // Criar perfil para o novo usuário
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: createdUser.user.id,
        name: payload.name,
        cpf: payload.cpf,
        email: payload.email,
        whatsapp: payload.whatsapp,
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-profile-creation-error',
        message: 'Failed to create profile for new user',
        metadata: { 
          userId: createdUser.user.id,
          error: profileError.message
        }
      });
    }

    return { id: createdUser.user.id, isExisting: false };
  }
}

// Função para validar produtos
async function validateProducts(productIds: string[], supabase: any) {
  const uniqueProductIds = [...new Set(productIds)];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, name, status')
    .in('id', uniqueProductIds);

  if (productsError) {
    throw new Error('Erro ao buscar produtos no banco de dados: ' + productsError.message);
  }

  if (!products || products.length !== uniqueProductIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));
    throw new Error(`Produtos não encontrados: ${missingIds.join(', ')}`);
  }

  // Verificar se todos os produtos estão ativos
  const inactiveProducts = products.filter(p => p.status !== 'ativo');
  if (inactiveProducts.length > 0) {
    throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
  }

  return products;
}

// Função para aplicar cupom
async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any) {
  if (!couponCode) {
    return { finalTotal: originalTotal };
  }

  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('code, discount_type, value, active')
    .eq('code', couponCode.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (couponError || !coupon) {
    throw new Error(`Cupom inválido ou inativo: ${couponCode}`);
  }

  let finalTotal = originalTotal;
  if (coupon.discount_type === 'percentage') {
    finalTotal = originalTotal * (1 - parseFloat(coupon.value) / 100);
  } else if (coupon.discount_type === 'fixed') {
    finalTotal = Math.max(0, originalTotal - parseFloat(coupon.value));
  }

  return { finalTotal, couponData: coupon };
}

// Função para criar pedido
async function createOrder(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any) {
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
    throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
  }

  return order;
}

// Função para processar pagamento PIX
async function processPixPayment(order: any, customerData: any, supabase: any) {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
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
    throw new Error('Erro ao criar pagamento PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const pixPaymentData = await asaasResponse.json();

  // Buscar QR Code do PIX
  const pixQrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${pixPaymentData.id}/pixQrCode`, {
    method: 'GET',
    headers: asaasHeaders
  });

  if (!pixQrCodeResponse.ok) {
    const errorData = await pixQrCodeResponse.json();
    throw new Error('Erro ao gerar QR Code PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const pixQrCodeData = await pixQrCodeResponse.json();

  // Atualizar pedido com ID do pagamento
  await supabase
    .from('orders')
    .update({ asaas_payment_id: pixPaymentData.id })
    .eq('id', order.id);

  return {
    id: pixPaymentData.id,
    orderId: order.id,
    payload: pixQrCodeData.payload,
    encodedImage: pixQrCodeData.encodedImage,
  };
}

// Função para processar pagamento com cartão
async function processCreditCardPayment(order: any, customerData: any, creditCardData: any, clientIpAddress: string, supabase: any) {
  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
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
    throw new Error('Erro ao processar pagamento com cartão: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const paymentData = await asaasResponse.json();

  // Atualizar pedido com ID do pagamento
  await supabase
    .from('orders')
    .update({ asaas_payment_id: paymentData.id })
    .eq('id', order.id);

  return { ...paymentData, orderId: order.id };
}

// Função principal
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
      context: 'create-asaas-payment-start',
      message: 'Payment creation process started',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        hasProductIds: !!requestBody.productIds,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code
      }
    });

    // ETAPA 1: Validar dados de entrada
    const validatedPayload = await validateRequestData(requestBody, supabase);

    // ETAPA 2: Gerenciar usuário (existente ou novo)
    const userData = await handleUserManagement(validatedPayload, supabase);
    userId = userData.id;

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
      context: 'create-asaas-payment-success',
      message: 'Payment creation process completed successfully',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        paymentMethod: validatedPayload.paymentMethod,
        finalTotal,
        originalTotal,
        discountApplied: originalTotal - finalTotal,
        wasExistingUser: userData.isExisting,
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
      context: 'create-asaas-payment-unhandled-error',
      message: `Payment creation failed: ${error.message}`,
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
    } else if (error.message.includes('Erro ao criar conta')) {
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
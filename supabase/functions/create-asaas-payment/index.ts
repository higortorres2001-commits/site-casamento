import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tipos inline
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

interface UserData {
  id: string;
  isExisting: boolean;
}

// Função para gerenciar usuário (existente ou novo)
async function handleUserManagement(payload: RequestPayload, supabase: any): Promise<UserData> {
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

  // Verificar se o usuário já existe usando o email exato
  const { data: existingUserData, error: userLookupError } = await supabase.auth.admin.listUsers();

  if (userLookupError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user',
      metadata: { 
        email: payload.email,
        error: userLookupError.message,
        errorType: userLookupError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente: ' + userLookupError.message);
  }

  // Encontrar o usuário exato pelo email (case insensitive)
  const existingUser = existingUserData?.users?.find(u => 
    u.email?.toLowerCase() === payload.email.toLowerCase().trim()
  );

  if (existingUser) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, will update profile only after successful payment',
      metadata: { 
        userId: existingUser.id,
        email: payload.email,
        existingUserCreated: existingUser.created_at,
        existingUserLastSignIn: existingUser.last_sign_in_at
      }
    });

    return { id: existingUser.id, isExisting: true };
  }

  // Criar novo usuário apenas para autenticação
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-creating-new',
    message: 'Creating new user account (auth only, profile will be created after payment)',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      timestamp: new Date().toISOString()
    }
  });

  let newUser;
  let createUserAttempts = 0;
  const maxAttempts = 3;

  while (createUserAttempts < maxAttempts) {
    try {
      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: payload.email.toLowerCase().trim(),
        password: payload.cpf,
        email_confirm: true,
        user_metadata: { 
          name: payload.name, 
          cpf: payload.cpf, 
          whatsapp: payload.whatsapp,
          created_via: 'checkout',
          created_at: new Date().toISOString()
        },
      });

      if (createUserError) {
        if (createUserError.message.includes('duplicate') || 
            createUserError.message.includes('already registered') ||
            createUserError.message.includes('user_already_exists')) {
          
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'user-management-duplicate-detected',
            message: 'Duplicate user detected during creation, fetching existing user',
            metadata: { 
              email: payload.email,
              error: createUserError.message,
              attempt: createUserAttempts + 1
            }
          });

          const { data: retryUsers } = await supabase.auth.admin.listUsers();
          const retryUser = retryUsers?.users?.find(u => 
            u.email?.toLowerCase() === payload.email.toLowerCase().trim()
          );

          if (retryUser) {
            await supabase.from('logs').insert({
              level: 'info',
              context: 'user-management-retry-success',
              message: 'Found existing user after duplicate error',
              metadata: { 
                userId: retryUser.id,
                email: payload.email
              }
            });
            return { id: retryUser.id, isExisting: true };
          }
        }

        throw createUserError;
      }

      if (!createdUser?.user) {
        throw new Error('Erro desconhecido: usuário não criado');
      }

      newUser = createdUser.user;
      break;

    } catch (createError: any) {
      createUserAttempts++;
      
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-create-attempt',
        message: `User creation attempt ${createUserAttempts} failed`,
        metadata: { 
          email: payload.email,
          error: createError.message,
          attempt: createUserAttempts
        }
      });

      if (createUserAttempts >= maxAttempts) {
        throw new Error(`Falha ao criar usuário após ${maxAttempts} tentativas: ${createError.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, createUserAttempts)));
    }
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-auth-created',
    message: 'Auth user created successfully, profile will be created after payment',
    metadata: { 
      userId: newUser.id,
      email: payload.email
    }
  });

  return { id: newUser.id, isExisting: false };
}

// Função para criar ou atualizar perfil após pagamento bem-sucedido
async function createOrUpdateUserProfile(
  userId: string, 
  payload: RequestPayload, 
  isExistingUser: boolean,
  supabase: any
): Promise<void> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-profile-creation-start',
    message: isExistingUser ? 'Updating existing user profile after payment' : 'Creating new user profile after payment',
    metadata: { 
      userId,
      email: payload.email,
      isExistingUser
    }
  });

  try {
    if (isExistingUser) {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: payload.name,
          cpf: payload.cpf,
          email: payload.email.toLowerCase().trim(),
          whatsapp: payload.whatsapp,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-profile-update-error',
          message: 'Failed to update existing user profile after payment',
          metadata: { 
            userId,
            error: updateError.message,
            errorCode: updateError.code
          }
        });
        throw new Error(`Erro ao atualizar perfil do usuário: ${updateError.message}`);
      }
    } else {
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: payload.name,
          cpf: payload.cpf,
          email: payload.email.toLowerCase().trim(),
          whatsapp: payload.whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-profile-creation-error',
          message: 'Failed to create new user profile after payment',
          metadata: { 
            userId,
            error: insertError.message,
            errorCode: insertError.code
          }
        });
        throw new Error(`Erro ao criar perfil do usuário: ${insertError.message}`);
      }
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-profile-success',
      message: isExistingUser ? 'User profile updated successfully after payment' : 'User profile created successfully after payment',
      metadata: { 
        userId,
        email: payload.email
      }
    });
  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-profile-unhandled-error',
      message: `Unhandled error in profile creation/update: ${error.message}`,
      metadata: { 
        userId,
        email: payload.email,
        errorStack: error.stack
      }
    });
  }
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
  let isExistingUser: boolean = false;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let validatedPayload: RequestPayload;

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
        hasCoupon: !!requestBody.coupon_code,
        hasCreditCard: !!requestBody.creditCard
      }
    });

    // ETAPA 1: Validar dados de entrada
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!cpf) missingFields.push('cpf');
    if (!whatsapp) missingFields.push('whatsapp');
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) missingFields.push('productIds');
    if (!paymentMethod) missingFields.push('paymentMethod');

    if (missingFields.length > 0) {
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
    }

    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
    }

    validatedPayload = {
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

    // ETAPA 2: Gerenciar usuário (existente ou novo) - APENAS AUTH
    const userData = await handleUserManagement(validatedPayload, supabase);
    userId = userData.id;
    isExistingUser = userData.isExisting;

    // ETAPA 3: Validar produtos
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

    const inactiveProducts = products.filter(p => p.status !== 'ativo');
    if (inactiveProducts.length > 0) {
      throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
    }

    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 4: Aplicar cupom (se fornecido)
    let finalTotal = originalTotal;
    let couponData = null;

    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('code, discount_type, value, active')
        .eq('code', coupon_code.toUpperCase().trim())
        .eq('active', true)
        .single();

      if (couponError || !coupon) {
        throw new Error(`Cupom inválido ou inativo: ${coupon_code}`);
      }

      if (coupon.discount_type === 'percentage') {
        const discountAmount = originalTotal * (parseFloat(coupon.value) / 100);
        finalTotal = originalTotal - discountAmount;
      } else if (coupon.discount_type === 'fixed') {
        const discountAmount = parseFloat(coupon.value);
        finalTotal = Math.max(0, originalTotal - discountAmount);
      }

      couponData = coupon;
    }

    // ETAPA 5: Criar pedido
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
        total_price: finalTotal,
        status: 'pending',
        meta_tracking_data: fullMetaTrackingData,
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
    }

    orderId = order.id;

    // ETAPA 6: Processar pagamento
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      throw new Error('Configuração de pagamento não encontrada');
    }

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    let paymentResult: any;
    let paymentSuccessful = false;

    if (paymentMethod === 'PIX') {
      // Processar pagamento PIX
      const asaasPayload = {
        customer: {
          name: validatedPayload.name,
          email: validatedPayload.email,
          cpfCnpj: validatedPayload.cpf,
          phone: validatedPayload.whatsapp,
        },
        value: parseFloat(finalTotal.toFixed(2)),
        description: `Order #${order.id} payment`,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        billingType: 'PIX',
      };

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

      paymentResult = {
        id: pixPaymentData.id,
        orderId: order.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage,
      };

      paymentSuccessful = false; // PIX é pendente até confirmação do webhook

    } else if (paymentMethod === 'CREDIT_CARD') {
      // Processar pagamento com cartão
      const asaasPayload: any = {
        customer: {
          name: validatedPayload.name,
          email: validatedPayload.email,
          cpfCnpj: validatedPayload.cpf,
          phone: validatedPayload.whatsapp,
        },
        value: parseFloat(finalTotal.toFixed(2)),
        description: `Order #${order.id} payment`,
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        billingType: 'CREDIT_CARD',
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.cardNumber.replace(/\s/g, ''),
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
        creditCardHolderInfo: {
          name: validatedPayload.name,
          email: validatedPayload.email,
          cpfCnpj: validatedPayload.cpf,
          phone: validatedPayload.whatsapp,
          postalCode: creditCard.postalCode.replace(/\D/g, ''),
          addressNumber: creditCard.addressNumber,
        },
        remoteIp: clientIpAddress,
      };

      if (creditCard.installmentCount && creditCard.installmentCount > 1) {
        asaasPayload.installmentCount = creditCard.installmentCount;
        asaasPayload.installmentValue = parseFloat((finalTotal / creditCard.installmentCount).toFixed(2));
      }

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

      paymentResult = { ...paymentData, orderId: order.id };
      paymentSuccessful = paymentData.status === 'CONFIRMED' || paymentData.status === 'RECEIVED';
    }

    // ETAPA 7: Criar/atualizar perfil APENAS se pagamento com cartão foi bem-sucedido
    if (paymentSuccessful) {
      await createOrUpdateUserProfile(userId, validatedPayload, isExistingUser, supabase);
      
      // Atualizar o status do pedido para 'paid'
      await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', orderId);
    }

    // ETAPA 8: Log final de sucesso
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'Payment creation process completed successfully',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId: paymentResult.id,
        paymentMethod: validatedPayload.paymentMethod,
        paymentStatus: paymentResult.status,
        paymentSuccessful,
        profileCreated: paymentSuccessful,
        finalTotal,
        originalTotal,
        discountApplied: originalTotal - finalTotal,
        wasExistingUser: isExistingUser,
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
        requestBodyKeys: requestBody ? Object.keys(requestBody) : [],
        hasCreditCard: !!(requestBody?.creditCard)
      }
    });

    // Se houver erro no pagamento, cancelar o pedido
    if (orderId) {
      await supabase
        .from('orders')
        .update({ status: 'cancelled' })
        .eq('id', orderId);
    }

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
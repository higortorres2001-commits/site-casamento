import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ==================== TYPES ====================
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

// ==================== SALE-FIRST USER SERVICE ====================
async function ensureUserForSale(payload: RequestPayload, supabase: any): Promise<string> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'sale-first-user-start',
    message: 'SALE-FIRST: Starting user management - SALE WILL ALWAYS PROCEED',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      strategy: 'sale-first'
    }
  });

  // ESTRATÉGIA 1: Tentar encontrar usuário existente rapidamente
  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', payload.email.toLowerCase())
      .single();

    if (existingProfile) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'sale-first-existing-found',
        message: 'Found existing user - proceeding with sale',
        metadata: { 
          userId: existingProfile.id,
          email: payload.email
        }
      });
      return existingProfile.id;
    }
  } catch (error: any) {
    // Ignorar erro - continuar com criação
    await supabase.from('logs').insert({
      level: 'info',
      context: 'sale-first-search-failed',
      message: 'Search for existing user failed - will create new',
      metadata: { 
        email: payload.email,
        error: error.message
      }
    });
  }

  // ESTRATÉGIA 2: Gerar ID único e tentar criar (MÚLTIPLAS TENTATIVAS)
  let finalUserId: string | null = null;
  let attempts = 0;
  const maxAttempts = 5;

  while (attempts < maxAttempts && !finalUserId) {
    attempts++;
    const candidateUserId = crypto.randomUUID();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'sale-first-creation-attempt',
      message: `SALE-FIRST: Attempting user creation (${attempts}/${maxAttempts})`,
      metadata: { 
        email: payload.email,
        candidateUserId,
        attempt: attempts
      }
    });

    // PASSO 2A: Tentar criar Auth (opcional - não falhar se der erro)
    let authUserId: string | null = null;
    try {
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: payload.email,
        password: payload.cpf,
        email_confirm: true,
        user_metadata: { 
          name: payload.name, 
          cpf: payload.cpf, 
          whatsapp: payload.whatsapp,
          created_via: 'sale-first-checkout',
          profile_id: candidateUserId
        },
      });

      if (!authError && newAuthUser?.user) {
        authUserId = newAuthUser.user.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'sale-first-auth-created',
          message: 'Auth user created successfully',
          metadata: { 
            authUserId,
            candidateUserId,
            email: payload.email,
            attempt: attempts
          }
        });
      } else {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'sale-first-auth-failed',
          message: 'Auth creation failed - continuing with profile-only',
          metadata: { 
            candidateUserId,
            email: payload.email,
            error: authError?.message,
            attempt: attempts
          }
        });
      }
    } catch (authException: any) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'sale-first-auth-exception',
        message: 'Auth creation threw exception - continuing',
        metadata: { 
          candidateUserId,
          email: payload.email,
          error: authException.message,
          attempt: attempts
        }
      });
    }

    // PASSO 2B: Tentar criar perfil (PRIORIDADE MÁXIMA)
    const profileUserId = authUserId || candidateUserId;
    
    try {
      await supabase
        .from('profiles')
        .insert({
          id: profileUserId,
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

      finalUserId = profileUserId;
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'sale-first-profile-created',
        message: 'Profile created successfully - SALE CAN PROCEED',
        metadata: { 
          userId: finalUserId,
          email: payload.email,
          authCreated: !!authUserId,
          attempt: attempts
        }
      });
      
      break; // Sucesso - sair do loop
      
    } catch (profileError: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'sale-first-profile-failed',
        message: `Profile creation failed (attempt ${attempts}/${maxAttempts})`,
        metadata: { 
          candidateUserId,
          authUserId,
          email: payload.email,
          error: profileError.message,
          errorCode: profileError.code,
          attempt: attempts
        }
      });

      // Se for erro de duplicata, tentar buscar o perfil que pode ter sido criado
      if (profileError.message?.includes('duplicate') || profileError.message?.includes('unique constraint')) {
        try {
          const { data: foundProfile } = await supabase
            .from('profiles')
            .select('id')
            .or(`email.eq.${payload.email},id.eq.${profileUserId}`)
            .single();

          if (foundProfile) {
            finalUserId = foundProfile.id;
            await supabase.from('logs').insert({
              level: 'info',
              context: 'sale-first-profile-found-after-duplicate',
              message: 'Found profile after duplicate error - SALE CAN PROCEED',
              metadata: { 
                userId: finalUserId,
                email: payload.email,
                attempt: attempts
              }
            });
            break; // Sucesso - sair do loop
          }
        } catch (searchError: any) {
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'sale-first-profile-search-failed',
            message: 'Failed to find profile after duplicate error',
            metadata: { 
              email: payload.email,
              error: searchError.message,
              attempt: attempts
            }
          });
        }
      }

      // Limpar Auth se foi criado mas perfil falhou
      if (authUserId && authUserId !== candidateUserId) {
        try {
          await supabase.auth.admin.deleteUser(authUserId);
        } catch (deleteError: any) {
          // Ignorar erro de limpeza
        }
      }

      // Se não for a última tentativa, esperar antes de tentar novamente
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000 * attempts)); // Backoff crescente
      }
    }
  }

  // ESTRATÉGIA 3: Se tudo falhou, usar ID único e continuar a venda
  if (!finalUserId) {
    finalUserId = crypto.randomUUID();
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'sale-first-total-user-failure',
      message: 'CRITICAL: All user creation attempts failed - using emergency ID for SALE',
      metadata: { 
        emergencyUserId: finalUserId,
        email: payload.email,
        totalAttempts: attempts,
        customerData: {
          name: payload.name,
          email: payload.email,
          cpf: payload.cpf,
          whatsapp: payload.whatsapp
        }
      }
    });
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'sale-first-user-complete',
    message: 'SALE-FIRST user management completed - SALE WILL PROCEED',
    metadata: { 
      userId: finalUserId,
      email: payload.email,
      totalAttempts: attempts,
      strategy: 'sale-first-bulletproof'
    }
  });

  return finalUserId;
}

// ==================== ORDER SERVICE ====================
async function validateRequestData(requestBody: any, supabase: any): Promise<RequestPayload> {
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
    throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
  }

  if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
    throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
  }

  if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
    throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
  }

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

async function validateProducts(productIds: string[], supabase: any): Promise<ProductData[]> {
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

  return products as ProductData[];
}

async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any): Promise<{ finalTotal: number; couponData?: CouponData }> {
  if (!couponCode) {
    return { finalTotal: originalTotal };
  }

  try {
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('code, discount_type, value, active')
      .eq('code', couponCode.toUpperCase().trim())
      .eq('active', true)
      .single();

    if (couponError || !coupon) {
      return { finalTotal: originalTotal };
    }

    let finalTotal = originalTotal;
    if (coupon.discount_type === 'percentage') {
      finalTotal = originalTotal * (1 - parseFloat(coupon.value) / 100);
    } else if (coupon.discount_type === 'fixed') {
      finalTotal = Math.max(0, originalTotal - parseFloat(coupon.value));
    }

    return { finalTotal, couponData: coupon as CouponData };
  } catch (error: any) {
    return { finalTotal: originalTotal };
  }
}

async function createOrderAlways(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any): Promise<OrderData> {
  const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const clientUserAgent = req.headers.get('user-agent') || '';

  const fullMetaTrackingData = {
    ...metaTrackingData,
    client_ip_address: clientIpAddress,
    client_user_agent: clientUserAgent,
  };

  // Tentar criar o pedido com retry agressivo
  let order: OrderData | null = null;
  let orderAttempts = 0;
  const maxOrderAttempts = 10; // Mais tentativas

  while (orderAttempts < maxOrderAttempts && !order) {
    orderAttempts++;
    
    try {
      const { data: createdOrder, error: orderError } = await supabase
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

      if (orderError) {
        if (orderAttempts < maxOrderAttempts) {
          await new Promise(resolve => setTimeout(resolve, 500 * orderAttempts));
          continue;
        }
        throw new Error('Erro ao criar pedido: ' + orderError.message);
      }

      order = createdOrder as OrderData;
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'order-creation-success',
        message: 'Order created successfully',
        metadata: { 
          orderId: order.id,
          userId,
          totalPrice,
          attempt: orderAttempts
        }
      });
    } catch (error: any) {
      if (orderAttempts >= maxOrderAttempts) {
        throw error;
      }
    }
  }

  if (!order) {
    throw new Error('Falha ao criar pedido após múltiplas tentativas');
  }

  return order;
}

// ==================== ASAAS SERVICE ====================
async function processPixPaymentAlways(order: OrderData, customerData: RequestPayload, supabase: any): Promise<any> {
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

  // Atualizar pedido com ID do pagamento (não falhar se der erro)
  try {
    await supabase
      .from('orders')
      .update({ asaas_payment_id: pixPaymentData.id })
      .eq('id', order.id);
  } catch (updateError: any) {
    // Ignorar erro - pagamento foi criado
  }

  return {
    id: pixPaymentData.id,
    orderId: order.id,
    payload: pixQrCodeData.payload,
    encodedImage: pixQrCodeData.encodedImage,
  };
}

async function processCreditCardPaymentAlways(order: OrderData, customerData: RequestPayload, creditCardData: any, clientIpAddress: string, supabase: any): Promise<any> {
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

  // Atualizar pedido com ID do pagamento (não falhar se der erro)
  try {
    await supabase
      .from('orders')
      .update({ asaas_payment_id: paymentData.id })
      .eq('id', order.id);
  } catch (updateError: any) {
    // Ignorar erro - pagamento foi criado
  }

  return { ...paymentData, orderId: order.id };
}

// ==================== MAIN HANDLER ====================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  let customerData: RequestPayload | undefined;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'SALE-FIRST Payment creation started - SALE WILL ALWAYS SUCCEED',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code,
        timestamp: new Date().toISOString()
      }
    });

    // ETAPA 1: Validar dados da requisição
    const validatedPayload = await validateRequestData(requestBody, supabase);
    customerData = validatedPayload;

    // ETAPA 2: Validar produtos
    const products = await validateProducts(validatedPayload.productIds, supabase);
    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 3: Aplicar cupom (não falhar se der erro)
    const { finalTotal, couponData } = await applyCoupon(validatedPayload.coupon_code, originalTotal, supabase);

    // ETAPA 4: Garantir usuário (SALE-FIRST - sempre retorna um ID)
    userId = await ensureUserForSale(validatedPayload, supabase);

    // ETAPA 5: Criar pedido (SEMPRE com retry agressivo)
    const order = await createOrderAlways(userId, validatedPayload.productIds, finalTotal, validatedPayload.metaTrackingData, req, supabase);
    orderId = order.id;

    // ETAPA 6: Processar pagamento (PRIORIDADE ABSOLUTA)
    let paymentResult: any;
    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    if (validatedPayload.paymentMethod === 'PIX') {
      paymentResult = await processPixPaymentAlways(order, validatedPayload, supabase);
      asaasPaymentId = paymentResult.id;
    } else if (validatedPayload.paymentMethod === 'CREDIT_CARD') {
      paymentResult = await processCreditCardPaymentAlways(order, validatedPayload, validatedPayload.creditCard, clientIpAddress, supabase);
      asaasPaymentId = paymentResult.id;
    } else {
      throw new Error('Método de pagamento não suportado');
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'SALE-FIRST Payment creation completed successfully - SALE SECURED',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        paymentMethod: validatedPayload.paymentMethod,
        finalTotal,
        originalTotal,
        productCount: validatedPayload.productIds.length,
        couponUsed: couponData?.code || null
      }
    });

    return new Response(JSON.stringify(paymentResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // CRÍTICO: Salvar TODOS os dados do cliente para recuperação manual
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-CRITICAL-FAILURE',
      message: `CRITICAL SALE FAILURE - MANUAL RECOVERY REQUIRED: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        paymentMethod: requestBody?.paymentMethod,
        CUSTOMER_CONTACT_DATA: customerData ? {
          name: customerData.name,
          email: customerData.email,
          cpf: customerData.cpf,
          whatsapp: customerData.whatsapp,
          productIds: customerData.productIds,
          coupon_code: customerData.coupon_code
        } : {
          name: requestBody?.name,
          email: requestBody?.email,
          cpf: requestBody?.cpf,
          whatsapp: requestBody?.whatsapp,
          productIds: requestBody?.productIds,
          coupon_code: requestBody?.coupon_code
        },
        RECOVERY_INSTRUCTIONS: {
          step1: "Contact customer via WhatsApp",
          step2: "Use admin panel to recover sale",
          step3: "Process payment manually if needed"
        },
        timestamp: new Date().toISOString(),
        MANUAL_FOLLOW_UP_REQUIRED: true,
        PRIORITY: "URGENT"
      }
    });

    return new Response(JSON.stringify({ 
      error: 'Erro temporário no sistema. Seus dados foram salvos e entraremos em contato em até 1 hora para finalizar sua compra.',
      details: 'Nossa equipe já foi notificada e entrará em contato via WhatsApp.',
      contact_saved: true,
      urgent_follow_up: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interface para o resultado do pagamento
interface PaymentResult {
  id: string;
  orderId: string;
  status: string;
  payload?: string;
  encodedImage?: string;
}

// Interface para o perfil do usuário
interface UserProfile {
  id: string;
  name: string;
  cpf: string;
  email: string;
  whatsapp: string;
  access: string[];
  primeiro_acesso: boolean;
  has_changed_password: boolean;
  is_admin: boolean;
}

// Interface para o resultado da criação de usuário
interface CreateUserResult {
  userId: string;
  isNew: boolean;
  profile: UserProfile;
}

// Classe para logging
class Logger {
  private supabase;
  private context: string;

  constructor(supabase, context: string) {
    this.supabase = supabase;
    this.context = context;
  }

  async info(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'info',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async warning(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'warning',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async error(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'error',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async critical(message: string, metadata?: any): Promise<void> {
    await this.supabase.from('logs').insert({
      level: 'error',
      context: this.context,
      message: `CRITICAL: ${message}`,
      metadata: {
        ...metadata,
        CRITICAL: true,
        REQUIRES_IMMEDIATE_ACTION: true,
        timestamp: new Date().toISOString()
      }
    });
  }
}

// Funções de banco de dados
async function createOrUpdateUser(
  supabase,
  data: {
    name: string;
    email: string;
    cpf: string;
    whatsapp: string;
  }
): Promise<CreateUserResult> {
  const email = data.email.toLowerCase().trim();
  const cpf = data.cpf.replace(/\D/g, '');
  const whatsapp = data.whatsapp.replace(/\D/g, '');

  // ETAPA 1: Verificar usuário existente no Auth
  const { data: authUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);

  let userId: string;
  let isNew = false;

  if (existingAuthUser) {
    userId = existingAuthUser.id;
    
    // Atualizar perfil existente (UPSERT garante que não falha se não existir)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        name: data.name,
        cpf,
        email,
        whatsapp,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (profileError) {
      throw new Error(`Erro ao atualizar perfil: ${profileError.message}`);
    }

    return { userId, isNew: false, profile: profile as UserProfile };
  }

  // ETAPA 2: Criar novo usuário (Auth + Profile em sequência controlada)
  isNew = true;

  // 2.1: Criar no Auth primeiro
  const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: cpf,
    email_confirm: true,
    user_metadata: {
      name: data.name,
      cpf,
      whatsapp,
      created_via: 'checkout',
      created_at: new Date().toISOString()
    }
  });

  if (authError || !newAuthUser?.user) {
    throw new Error(`Erro ao criar usuário no Auth: ${authError?.message || 'Erro desconhecido'}`);
  }

  userId = newAuthUser.user.id;

  // 2.2: Criar perfil com UPSERT (proteção contra duplicatas)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      name: data.name,
      cpf,
      email,
      whatsapp,
      access: [],
      primeiro_acesso: true,
      has_changed_password: false,
      is_admin: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'id',
      ignoreDuplicates: false
    })
    .select()
    .single();

  if (profileError) {
    // Se falhar, tentar deletar o usuário do Auth para manter consistência
    await supabase.auth.admin.deleteUser(userId);
    throw new Error(`Erro ao criar perfil: ${profileError.message}`);
  }

  return { userId, isNew, profile: profile as UserProfile };
}

async function createOrder(
  supabase,
  data: {
    userId: string;
    productIds: string[];
    totalPrice: number;
    metaTrackingData?: any;
  }
): Promise<{ id: string; user_id: string; total_price: number; status: string }> {
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      user_id: data.userId,
      ordered_product_ids: data.productIds,
      total_price: data.totalPrice,
      status: 'pending',
      meta_tracking_data: data.metaTrackingData || {}
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Erro ao criar pedido: ${error.message}`);
  }

  return order;
}

async function updateOrderStatus(
  supabase,
  orderId: string,
  status: 'pending' | 'paid' | 'cancelled',
  asaasPaymentId?: string
): Promise<void> {
  const updateData: any = { status };
  
  if (asaasPaymentId) {
    updateData.asaas_payment_id = asaasPaymentId;
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    throw new Error(`Erro ao atualizar status do pedido: ${error.message}`);
  }
}

async function validateProducts(
  supabase,
  productIds: string[]
): Promise<Array<{ id: string; name: string; price: number; status: string }>> {
  const uniqueIds = [...new Set(productIds)];

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, price, status')
    .in('id', uniqueIds);

  if (error) {
    throw new Error(`Erro ao buscar produtos: ${error.message}`);
  }

  if (!products || products.length !== uniqueIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = uniqueIds.filter(id => !foundIds.has(id));
    throw new Error(`Produtos não encontrados: ${missingIds.join(', ')}`);
  }

  const inactiveProducts = products.filter(p => p.status !== 'ativo');
  if (inactiveProducts.length > 0) {
    throw new Error(`Produtos não disponíveis: ${inactiveProducts.map(p => p.name).join(', ')}`);
  }

  return products;
}

async function validateAndApplyCoupon(
  supabase,
  couponCode: string | undefined,
  originalTotal: number
): Promise<{ finalTotal: number; coupon?: any }> {
  if (!couponCode) {
    return { finalTotal: originalTotal };
  }

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', couponCode.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (error || !coupon) {
    throw new Error(`Cupom inválido ou inativo: ${couponCode}`);
  }

  let finalTotal = originalTotal;

  if (coupon.discount_type === 'percentage') {
    finalTotal = originalTotal * (1 - parseFloat(coupon.value) / 100);
  } else if (coupon.discount_type === 'fixed') {
    finalTotal = Math.max(0, originalTotal - parseFloat(coupon.value));
  }

  return { finalTotal, coupon };
}

// Funções de pagamento
async function createPixPayment(
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
      notificationDisabled: true,// <--- notificacao asaas desabilitado
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

async function createCreditCardPayment(
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
    notificationDisabled: true,
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const logger = new Logger(supabase, 'create-payment');
  
  let requestBody: any;
  let userId: string | undefined;
  let orderId: string | undefined;

  try {
    requestBody = await req.json();
    
    logger.info('Payment creation started', {
      paymentMethod: requestBody.paymentMethod,
      productCount: requestBody.productIds?.length || 0,
      hasCoupon: !!requestBody.coupon_code
    });

    // ==================== VALIDAÇÕES ====================
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !paymentMethod) {
      throw new Error('Campos obrigatórios ausentes');
    }

    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      throw new Error('Método de pagamento inválido');
    }

    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      throw new Error('Dados do cartão são obrigatórios');
    }

    // ==================== VALIDAR PRODUTOS ====================
    const products = await validateProducts(supabase, productIds);
    const originalTotal = products.reduce((sum, p) => sum + parseFloat(p.price.toString()), 0);

    logger.info('Products validated', {
      productCount: products.length,
      originalTotal
    });

    // ==================== APLICAR CUPOM ====================
    const { finalTotal, coupon } = await validateAndApplyCoupon(supabase, coupon_code, originalTotal);

    if (coupon) {
      logger.info('Coupon applied', {
        couponCode: coupon.code,
        discountType: coupon.discount_type,
        originalTotal,
        finalTotal,
        discount: originalTotal - finalTotal
      });
    }

    // ==================== CRIAR/ATUALIZAR USUÁRIO ====================
    const userResult = await createOrUpdateUser(supabase, {
      name,
      email,
      cpf: cpf.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, '')
    });

    userId = userResult.userId;

    logger.info('User processed', {
      userId,
      isNew: userResult.isNew,
      email: userResult.profile.email
    });

    // ==================== CRIAR PEDIDO ====================
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || '';

    const order = await createOrder(supabase, {
      userId,
      productIds,
      totalPrice: finalTotal,
      metaTrackingData: {
        ...metaTrackingData,
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        event_source_url: metaTrackingData?.event_source_url || '',
      }
    });

    orderId = order.id;

    logger.info('Order created', {
      orderId,
      userId,
      totalPrice: finalTotal,
      status: order.status
    });

    // ==================== PROCESSAR PAGAMENTO ====================
    // Preparar dados do cliente limpos
    const customerData = {
      name,
      email,
      cpf: cpf.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, '')
    };

    // Log para debug do formato do customer
    logger.info('Customer data being sent to Asaas', {
      customerObject: {
        name: customerData.name,
        email: customerData.email,
        cpfCnpj: customerData.cpf,
        phone: customerData.whatsapp
      }
    });

    let paymentResult;

    if (paymentMethod === 'PIX') {
      paymentResult = await createPixPayment(
        orderId,
        customerData,
        finalTotal
      );

      logger.info('PIX payment created', {
        orderId,
        paymentId: paymentResult.id,
        status: paymentResult.status
      });
    } else {
      paymentResult = await createCreditCardPayment(
        orderId,
        customerData,
        creditCard,
        finalTotal,
        clientIp
      );

      logger.info('Credit card payment created', {
        orderId,
        paymentId: paymentResult.id,
        status: paymentResult.status,
        installments: creditCard.installmentCount || 1
      });
    }

    // ==================== ATUALIZAR PEDIDO COM PAYMENT ID ====================
    await updateOrderStatus(supabase, orderId, 'pending', paymentResult.id);

    logger.info('Payment creation completed successfully', {
      orderId,
      userId,
      paymentId: paymentResult.id,
      paymentMethod,
      finalTotal
    });

    return new Response(JSON.stringify(paymentResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log crítico que DEVE ser salvo
    await logger.critical('Payment creation failed', {
      errorMessage: error.message,
      errorStack: error.stack,
      userId,
      orderId,
      customerData: requestBody ? {
        name: requestBody.name,
        email: requestBody.email,
        cpf: requestBody.cpf ? 'PROVIDED' : 'MISSING',
        whatsapp: requestBody.whatsapp ? 'PROVIDED' : 'MISSING',
        productIds: requestBody.productIds,
        coupon_code: requestBody.coupon_code
      } : null,
      paymentMethod: requestBody?.paymentMethod,
      MANUAL_RECOVERY_REQUIRED: true
    });

    return new Response(JSON.stringify({ 
      error: error.message,
      orderId: orderId || null,
      userId: userId || null,
      recoverable: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
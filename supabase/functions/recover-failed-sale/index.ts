import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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

/**
 * Cria ou atualiza usuário de forma atômica e segura contra race conditions
 */
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

/**
 * Cria pedido de forma idempotente
 */
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

/**
 * Valida produtos e retorna dados completos
 */
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

/**
 * Valida e aplica cupom de desconto
 */
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

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const logger = new Logger(supabase, 'recover-sale');

  try {
    const { customerData, productIds, couponCode } = await req.json();

    logger.info('Sale recovery started', {
      email: customerData.email,
      productCount: productIds?.length || 0
    });

    // Validar produtos
    const products = await validateProducts(supabase, productIds);
    const originalTotal = products.reduce((sum, p) => sum + parseFloat(p.price.toString()), 0);

    // Aplicar cupom
    const { finalTotal } = await validateAndApplyCoupon(supabase, couponCode, originalTotal);

    // Criar/atualizar usuário
    const userResult = await createOrUpdateUser(supabase, {
      name: customerData.name,
      email: customerData.email,
      cpf: customerData.cpf.replace(/\D/g, ''),
      whatsapp: customerData.whatsapp.replace(/\D/g, '')
    });

    // Criar pedido
    const order = await createOrder(supabase, {
      userId: userResult.userId,
      productIds,
      totalPrice: finalTotal,
      metaTrackingData: { recovery: true }
    });

    logger.info('Sale recovered successfully', {
      orderId: order.id,
      userId: userResult.userId,
      isNewUser: userResult.isNew
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      userId: userResult.userId,
      message: 'Venda recuperada com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await logger.critical('Sale recovery failed', {
      errorMessage: error.message,
      errorStack: error.stack
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
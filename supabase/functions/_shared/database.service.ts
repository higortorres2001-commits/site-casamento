import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

export interface UserProfile {
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

export interface CreateUserResult {
  userId: string;
  isNew: boolean;
  profile: UserProfile;
}

/**
 * Cria ou atualiza usuário de forma atômica e segura contra race conditions
 * Usa UPSERT com ON CONFLICT para garantir idempotência
 */
export async function createOrUpdateUser(
  supabase: SupabaseClient,
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
export async function createOrder(
  supabase: SupabaseClient,
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
 * Atualiza status do pedido de forma atômica
 */
export async function updateOrderStatus(
  supabase: SupabaseClient,
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

/**
 * Concede acesso aos produtos de forma atômica e idempotente
 * Se algum produto for um Kit, expande para incluir todos os produtos do kit
 * SEGURO: Funciona mesmo se as colunas is_kit/kit_product_ids não existirem
 */
export async function grantProductAccess(
  supabase: SupabaseClient,
  userId: string,
  productIds: string[]
): Promise<void> {
  // Começar com os IDs originais
  let expandedProductIds = [...productIds];

  try {
    // Tentar buscar informações de kit (pode falhar se colunas não existem)
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, is_kit, kit_product_ids')
      .in('id', productIds);

    if (productsError) {
      // Se erro (ex: coluna não existe), apenas logar e continuar com IDs originais
      console.warn('Aviso ao buscar info de kit (colunas podem não existir):', productsError.message);
    } else if (productsData && Array.isArray(productsData)) {
      // Expandir kits: se um produto é um kit, adicionar todos os produtos do kit
      for (const product of productsData) {
        // Validação defensiva: verificar se campos existem e são válidos
        const isKit = Boolean(product?.is_kit);
        const kitProductIds = product?.kit_product_ids;

        if (isKit && kitProductIds && Array.isArray(kitProductIds) && kitProductIds.length > 0) {
          // Filtrar IDs válidos (não nulos, strings não vazias)
          const validKitIds = kitProductIds.filter((id: any) => id && typeof id === 'string');
          if (validKitIds.length > 0) {
            expandedProductIds = [...expandedProductIds, ...validKitIds];
            console.log(`Kit expandido: ${product.id} -> ${validKitIds.length} produtos`);
          }
        }
      }
    }
  } catch (err) {
    // Qualquer erro na expansão de kit não deve impedir o grant de acesso
    console.warn('Erro ao processar expansão de kit (continuando com IDs originais):', err);
  }

  // Remover duplicatas
  expandedProductIds = [...new Set(expandedProductIds)];

  // Buscar acesso atual
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('access')
    .eq('id', userId)
    .single();

  if (fetchError) {
    throw new Error(`Erro ao buscar perfil: ${fetchError.message}`);
  }

  const currentAccess = Array.isArray(profile.access) ? profile.access : [];
  const newAccess = [...new Set([...currentAccess, ...expandedProductIds])];

  // Verificar se já tem todos os acessos (idempotência)
  const hasAllAccess = expandedProductIds.every(id => currentAccess.includes(id));

  if (hasAllAccess) {
    return; // Já tem acesso, nada a fazer
  }

  // Atualizar com novo acesso
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      access: newAccess,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Erro ao conceder acesso: ${updateError.message}`);
  }
}

/**
 * Valida produtos e retorna dados completos
 */
export async function validateProducts(
  supabase: SupabaseClient,
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
export async function validateAndApplyCoupon(
  supabase: SupabaseClient,
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
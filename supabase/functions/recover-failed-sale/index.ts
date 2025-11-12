import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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

  try {
    const { customerData, paymentMethod, productIds, couponCode } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'recover-failed-sale-start',
      message: 'Starting manual sale recovery process',
      metadata: { 
        customerEmail: customerData.email,
        paymentMethod,
        productCount: productIds?.length || 0,
        hasCoupon: !!couponCode
      }
    });

    // ETAPA 1: Criar/encontrar usuário de forma segura
    let userId: string;
    
    // Tentar encontrar usuário existente primeiro
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email?.toLowerCase() === customerData.email.toLowerCase());
    
    if (existingUser) {
      userId = existingUser.id;
      await supabase.from('logs').insert({
        level: 'info',
        context: 'recover-failed-sale-user-found',
        message: 'Found existing user for recovery',
        metadata: { userId, email: customerData.email }
      });
    } else {
      // Criar novo usuário
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: customerData.email,
        password: customerData.cpf,
        email_confirm: true,
        user_metadata: { 
          name: customerData.name, 
          cpf: customerData.cpf, 
          whatsapp: customerData.whatsapp,
          created_via: 'manual-recovery'
        },
      });

      if (createError || !newUser?.user) {
        // Se falhar, usar UUID gerado
        userId = crypto.randomUUID();
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'recover-failed-sale-fallback-id',
          message: 'Using fallback UUID for user creation',
          metadata: { 
            fallbackUserId: userId,
            email: customerData.email,
            error: createError?.message
          }
        });
      } else {
        userId = newUser.user.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'recover-failed-sale-user-created',
          message: 'Created new user for recovery',
          metadata: { userId, email: customerData.email }
        });
      }
    }

    // ETAPA 2: Criar/atualizar perfil (não falhar se der erro)
    try {
      await supabase
        .from('profiles')
        .upsert({
          id: userId,
          name: customerData.name,
          cpf: customerData.cpf,
          email: customerData.email,
          whatsapp: customerData.whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
    } catch (profileError: any) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'recover-failed-sale-profile-error',
        message: 'Profile creation failed but continuing with sale recovery',
        metadata: { 
          userId,
          error: profileError.message,
          customerData
        }
      });
    }

    // ETAPA 3: Buscar produtos
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', productIds);

    if (productsError || !products) {
      throw new Error('Produtos não encontrados: ' + (productsError?.message || 'Erro desconhecido'));
    }

    const totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 4: Criar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: productIds,
        total_price: totalPrice,
        status: 'pending',
        meta_tracking_data: { recovery: true, original_failure: true },
      })
      .select()
      .single();

    if (orderError || !order) {
      throw new Error('Erro ao criar pedido de recuperação: ' + (orderError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'recover-failed-sale-success',
      message: 'Sale recovery completed successfully',
      metadata: { 
        orderId: order.id,
        userId,
        totalPrice,
        customerEmail: customerData.email,
        productCount: productIds.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      userId,
      message: 'Venda recuperada com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'recover-failed-sale-error',
      message: `Failed to recover sale: ${error.message}`,
      metadata: {
        error: error.message,
        errorStack: error.stack,
        customerData: customerData || requestBody
      }
    });

    return new Response(JSON.stringify({ 
      error: 'Erro na recuperação da venda: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
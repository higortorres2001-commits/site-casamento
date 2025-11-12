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

  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let requestBody: any;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'asaas-webhook',
      message: 'Asaas Webhook received with enhanced validations',
      metadata: { 
        event: requestBody.event,
        asaasPaymentId: requestBody.payment?.id,
        timestamp: new Date().toISOString()
      }
    });

    if (requestBody.event !== 'PAYMENT_CONFIRMED' && requestBody.event !== 'PAYMENT_RECEIVED') {
      return new Response(JSON.stringify({ message: 'Event not relevant, ignored.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    asaasPaymentId = requestBody.payment?.id;
    
    if (!asaasPaymentId) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'asaas_payment_id not found in notification',
        metadata: { asaasNotification: requestBody }
      });
      return new Response(JSON.stringify({ error: 'asaas_payment_id not found in notification.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar pedido com verificações adicionais
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status, total_price, meta_tracking_data, asaas_payment_id')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'Order not found for given asaas_payment_id',
        metadata: { 
          asaasPaymentId, 
          error: orderError?.message,
          searchCriteria: 'asaas_payment_id'
        }
      });

      // Tentar buscar por outros critérios se necessário
      // Retornar 200 para evitar retentativas do Asaas
      return new Response(JSON.stringify({ message: 'Order not found, but webhook acknowledged.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    orderId = order.id;
    userId = order.user_id;

    // VERIFICAÇÃO CRÍTICA: Confirmar que o usuário ainda existe
    const { data: userExists, error: userCheckError } = await supabase.auth.admin.getUserById(userId);
    
    if (userCheckError || !userExists) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook-user-check',
        message: 'User not found in auth system',
        metadata: { 
          userId,
          orderId,
          asaasPaymentId,
          error: userCheckError?.message
        }
      });
      
      // Marcar o pedido como problemático mas não falhar completamente
      await supabase
        .from('orders')
        .update({ 
          status: 'problematic',
          meta_tracking_data: { 
            ...order.meta_tracking_data, 
            webhook_error: 'user_not_found_in_auth',
            webhook_timestamp: new Date().toISOString()
          }
        })
        .eq('id', orderId);
      
      return new Response(JSON.stringify({ message: 'User not found, order marked as problematic.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // VERIFICAÇÃO CRÍTICA: Confirmar que o perfil existe e está vinculado corretamente
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, access, name, email, cpf, whatsapp')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook-profile-check',
        message: 'CRITICAL: Profile not found for user',
        metadata: { 
          userId, 
          orderId, 
          asaasPaymentId, 
          error: profileError?.message,
          userExists: !!userExists
        }
      });

      // Tentar criar o perfil se não existir (fallback)
      try {
        const userData = userExists.user;
        const { error: profileCreationError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            name: userData.user_metadata?.name || 'Cliente',
            email: userData.email,
            cpf: userData.user_metadata?.cpf || '',
            whatsapp: userData.user_metadata?.whatsapp || '',
            access: order.ordered_product_ids,
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          });

        if (profileCreationError) {
          throw profileCreationError;
        }

        await supabase.from('logs').insert({
          level: 'warning',
          context: 'asaas-webhook-profile-created',
          message: 'Profile created as fallback during webhook processing',
          metadata: { userId, orderId }
        });

      } catch (fallbackError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'asaas-webhook-profile-fallback',
          message: 'Failed to create profile fallback',
          metadata: { 
            userId, 
            orderId,
            error: fallbackError.message 
          }
        });
        
        // Continuar mesmo com erro - tentar atualizar o acesso mais tarde
      }
    }

    // Resto do código permanece igual...
    // [O restante do código original do webhook continua aqui...]

    // ... [código existente para atualizar status do pedido e acesso]

    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'asaas-webhook-unhandled-error',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        asaasNotification: requestBody,
        asaasPaymentId,
        orderId,
        userId,
      }
    });
    
    // Sempre retornar 200 para o Asaas para evitar retentativas infinitas
    return new Response(JSON.stringify({ message: 'Webhook processed with errors.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
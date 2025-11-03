import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para gerar senha padrão baseada no CPF
// Formato: Sem@ + 3 primeiros dígitos do CPF
function generateDefaultPassword(cpf: string): string {
  const cleanCpf = cpf.replace(/[^0-9]/g, '');
  const cpfPrefix = cleanCpf.substring(0, 3);
  return `Sem@${cpfPrefix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging purposes
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let requestBody: any;
  let paymentId: string | undefined;
  let userId: string | undefined;
  let orderId: string | undefined;

  try {
    requestBody = await req.json();
    paymentId = requestBody.payment_id;

    if (!paymentId) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'Missing payment_id in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing payment_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'ASAAS_API_KEY or ASAAS_API_URL not set in Supabase secrets.',
        metadata: { paymentId }
      });
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY or ASAAS_API_URL not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments/${paymentId}`;
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    const asaasResponse = await fetch(asaasPaymentsUrl, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas API error checking payment status:', errorData);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'Failed to check payment status with Asaas.',
        metadata: { paymentId, asaasError: errorData, statusCode: asaasResponse.status }
      });
      return new Response(JSON.stringify({ error: 'Failed to check payment status with Asaas.', details: errorData }), {
        status: asaasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasData = await asaasResponse.json();
    const paymentStatus = asaasData.status;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'check-payment-status',
      message: `Payment status checked for ${paymentId}: ${paymentStatus}`,
      metadata: { paymentId, status: paymentStatus }
    });

    // Se o pagamento estiver confirmado ou recebido, liberar acesso
    if (paymentStatus === "CONFIRMED" || paymentStatus === "RECEIVED") {
      // 1. Encontrar o pedido associado ao pagamento
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('id, user_id, ordered_product_ids, status')
        .eq('asaas_payment_id', paymentId)
        .single();

      if (orderError || !order) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'check-payment-status',
          message: 'Order not found for payment ID.',
          metadata: { paymentId, error: orderError?.message }
        });
        return new Response(JSON.stringify({ status: paymentStatus, accessGranted: false, reason: "Order not found" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      orderId = order.id;
      userId = order.user_id;

      // 2. Atualizar o status do pedido para 'paid' se ainda não estiver
      if (order.status !== 'paid') {
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', order.id);

        if (updateOrderError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'check-payment-status',
            message: 'Failed to update order status.',
            metadata: { orderId, paymentId, error: updateOrderError.message }
          });
        }
      }

      // 3. Buscar o perfil do usuário para obter acesso atual
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, access, name, email, cpf, whatsapp')
        .eq('id', userId)
        .single();

      if (profileError || !profile) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'check-payment-status',
          message: 'User profile not found.',
          metadata: { userId, orderId, paymentId, error: profileError?.message }
        });
        return new Response(JSON.stringify({ status: paymentStatus, accessGranted: false, reason: "Profile not found" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 4. Mesclar os IDs de produtos pedidos com o array 'access' existente, sem duplicatas
      const orderedProductIds = order.ordered_product_ids;
      const existingAccess = profile.access || [];
      const newAccess = [...new Set([...existingAccess, ...orderedProductIds])];

      // 5. Atualizar o perfil do usuário com o novo array 'access'
      // NÃO definir has_changed_password como false - o usuário já tem a senha padrão
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ access: newAccess })
        .eq('id', userId);

      if (updateProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'check-payment-status',
          message: 'Failed to update user profile access.',
          metadata: { userId, orderId, paymentId, error: updateProfileError.message }
        });
        return new Response(JSON.stringify({ status: paymentStatus, accessGranted: false, reason: "Failed to update profile" }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 6. Enviar email com detalhes de acesso
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY && profile.email && profile.cpf) {
        const defaultPassword = generateDefaultPassword(profile.cpf);
        
        const emailSubject = "Seu acesso foi liberado!";
        const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'YOUR_APP_URL';
        const loginUrl = `${appUrl}/login`;
        
        const emailBody = `
          Parabéns! Seu pagamento foi confirmado. Para acessar seus produtos, use os dados abaixo na nossa página de login:

          Login: ${loginUrl}
          Email: ${profile.email}
          Senha: ${defaultPassword}

          Guarde esta senha com segurança. Você pode alterá-la a qualquer momento nas configurações da sua conta.
        `;

        try {
          const resendResponse = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
              from: 'onboarding@resend.dev',
              to: profile.email,
              subject: emailSubject,
              html: emailBody.replace(/\n/g, '<br/>'),
            }),
          });

          if (!resendResponse.ok) {
            const errorData = await resendResponse.json();
            await supabase.from('logs').insert({
              level: 'error',
              context: 'check-payment-status',
              message: 'Error sending access liberation email via Resend.',
              metadata: { userId, orderId, paymentId, email: profile.email, resendError: errorData }
            });
          } else {
            await supabase.from('logs').insert({
              level: 'info',
              context: 'check-payment-status',
              message: `Access liberation email sent to ${profile.email}.`,
              metadata: { userId, orderId, paymentId, email: profile.email }
            });
          }
        } catch (emailError: any) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'check-payment-status',
            message: `Error sending email: ${emailError.message}`,
            metadata: { userId, orderId, paymentId, email: profile.email }
          });
        }
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'check-payment-status',
        message: 'Access granted successfully.',
        metadata: { userId, orderId, paymentId, newAccess }
      });

      return new Response(JSON.stringify({ status: paymentStatus, accessGranted: true }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se o pagamento não estiver confirmado, apenas retornar o status
    return new Response(JSON.stringify({ status: paymentStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'check-payment-status',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        paymentId,
        requestBody,
        userId,
        orderId
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
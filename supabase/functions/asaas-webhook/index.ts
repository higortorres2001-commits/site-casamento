import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client with service role for admin access
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
    
    // 1. Log the received webhook payload
    await supabase.from('logs').insert({
      level: 'info',
      context: 'asaas-webhook',
      message: 'Asaas Webhook received.',
      metadata: { asaasNotification: requestBody }
    });

    // 2. Check for relevant event (PAYMENT_CONFIRMED)
    if (requestBody.event !== 'PAYMENT_CONFIRMED') {
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
        message: 'asaas_payment_id not found in notification.',
        metadata: { asaasNotification: requestBody }
      });
      return new Response(JSON.stringify({ error: 'asaas_payment_id not found in notification.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Find the order in the 'orders' table
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status, total_price, meta_tracking_data')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'Order not found for the given asaas_payment_id.',
        metadata: { asaasPaymentId, error: orderError?.message }
      });
      // Return 200 to prevent Asaas from retrying endlessly if the order is genuinely missing
      return new Response(JSON.stringify({ message: 'Order not found, but webhook acknowledged.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    orderId = order.id;
    userId = order.user_id;

    // 4. If the order status is not 'paid', update it to 'paid'
    if (order.status !== 'paid') {
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order.id);

      if (updateOrderError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'asaas-webhook',
          message: 'Failed to update order status.',
          metadata: { orderId, asaasPaymentId, error: updateOrderError.message }
        });
        return new Response(JSON.stringify({ error: 'Failed to update order status.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 5. Fetch the user profile to get current access and contact info
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, access, name, email, cpf, whatsapp')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'User profile not found.',
        metadata: { userId, orderId, asaasPaymentId, error: profileError?.message }
      });
      return new Response(JSON.stringify({ message: 'User profile not found, but order updated.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Merge ordered_product_ids with the existing 'access' array without duplicates
    const orderedProductIds = order.ordered_product_ids;
    const existingAccess = profile.access || [];
    const newAccess = [...new Set([...existingAccess, ...orderedProductIds])];

    // 7. Update the 'profiles' table with the new 'access' array and set has_changed_password to FALSE (to force password change on first login)
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ access: newAccess, has_changed_password: false }) // Set to false to force password change
      .eq('id', userId);

    if (updateProfileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'asaas-webhook',
        message: 'Failed to update user profile access.',
        metadata: { userId, orderId, asaasPaymentId, orderedProductIds, error: updateProfileError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to update user profile access.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'asaas-webhook',
      message: `Profile ${userId} access updated successfully.`,
      metadata: { userId, orderId, asaasPaymentId, newAccess }
    });

    // --- Meta CAPI Purchase Event ---
    const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID');
    const META_CAPI_ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN');

    if (META_PIXEL_ID && META_CAPI_ACCESS_TOKEN && process.env.NODE_ENV === 'production') {
      const capiPayload = {
        data: [
          {
            event_name: 'Purchase',
            event_time: Math.floor(Date.now() / 1000),
            event_source_url: order.meta_tracking_data?.event_source_url || '',
            action_source: 'website',
            user_data: {
              em: profile.email,
              ph: profile.whatsapp,
              fbc: order.meta_tracking_data?.fbc,
              fbp: order.meta_tracking_data?.fbp,
              client_ip_address: order.meta_tracking_data?.client_ip_address,
              client_user_agent: order.meta_tracking_data?.client_user_agent,
            },
            custom_data: {
              value: order.total_price.toFixed(2),
              currency: 'BRL',
              order_id: order.id,
            },
            event_id: `purchase_capi_${order.id}_${Date.now()}`,
          },
        ],
      };

      try {
        const metaResponse = await fetch(`https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(capiPayload),
        });

        if (!metaResponse.ok) {
          const errorData = await metaResponse.json();
          await supabase.from('logs').insert({
            level: 'error',
            context: 'meta-capi-purchase',
            message: 'Failed to send Purchase event to Meta CAPI.',
            metadata: { orderId, userId, capiPayload, metaError: errorData, statusCode: metaResponse.status }
          });
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'meta-capi-purchase',
            message: 'Purchase event sent to Meta CAPI successfully.',
            metadata: { orderId, userId }
          });
        }
      } catch (metaError: any) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'meta-capi-purchase',
          message: `Unhandled error sending Purchase event to Meta CAPI: ${metaError.message}`,
          metadata: { orderId, userId, errorStack: metaError.stack }
        });
      }
    }
    // --- End Meta CAPI Purchase Event ---

    // 8. Send "Acesso Liberado" email with login details
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && profile.email && profile.cpf) {
      const emailSubject = "Seu acesso foi liberado!";
      // Assuming the client application URL is derived from SUPABASE_URL for now, 
      // but ideally this should be a separate environment variable (e.g., APP_URL)
      const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'YOUR_APP_URL';
      const loginUrl = `${appUrl}/login`;
      
      const emailBody = `
        Parabéns! Seu pagamento foi confirmado. Para acessar seus produtos, use os dados abaixo na nossa página de login:

        Login: ${loginUrl}
        Email: ${profile.email}
        Senha: ${profile.cpf} (os números do seu CPF)

        Recomendamos trocar sua senha no primeiro acesso.
      `;

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
          context: 'asaas-webhook',
          message: 'Error sending access liberation email via Resend.',
          metadata: { userId, orderId, asaasPaymentId, email: profile.email, resendError: errorData }
        });
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'asaas-webhook',
          message: `Access liberation email sent to ${profile.email}.`,
          metadata: { userId, orderId, asaasPaymentId, email: profile.email }
        });
      }
    }

    // Return a 200 OK response to Asaas
    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'asaas-webhook',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        asaasNotification: requestBody,
        asaasPaymentId,
        orderId,
        userId,
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
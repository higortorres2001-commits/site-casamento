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

  try {
    const asaasNotification = await req.json();
    console.log('Asaas Webhook received:', asaasNotification);

    // Check if the event is PAYMENT_CONFIRMED
    if (asaasNotification.event !== 'PAYMENT_CONFIRMED') {
      console.log('Ignoring non-PAYMENT_CONFIRMED event:', asaasNotification.event);
      return new Response(JSON.stringify({ message: 'Event not relevant, ignored.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentId = asaasNotification.payment.id;

    if (!asaasPaymentId) {
      return new Response(JSON.stringify({ error: 'asaas_payment_id not found in notification.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Find the order in the 'orders' table
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      console.error('Error finding order:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found for the given asaas_payment_id.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. If the order status is not 'paid', update it to 'paid'
    if (order.status !== 'paid') {
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: 'paid' })
        .eq('id', order.id);

      if (updateOrderError) {
        console.error('Error updating order status:', updateOrderError);
        return new Response(JSON.stringify({ error: 'Failed to update order status.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      console.log(`Order ${order.id} status updated to 'paid'.`);
    } else {
      console.log(`Order ${order.id} already 'paid', skipping status update.`);
    }

    // 3. Get user_id and ordered_product_ids from the order
    const userId = order.user_id;
    const orderedProductIds = order.ordered_product_ids;

    // 4. Fetch the user profile to get current access, name, email, and CPF
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, access, name, email, cpf') // Select email and cpf
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Merge ordered_product_ids with the existing 'access' array without duplicates
    const existingAccess = profile.access || [];
    const newAccess = [...new Set([...existingAccess, ...orderedProductIds])];

    // 6. Update the 'profiles' table with the new 'access' array
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ access: newAccess })
      .eq('id', userId);

    if (updateProfileError) {
      console.error('Error updating profile access:', updateProfileError);
      return new Response(JSON.stringify({ error: 'Failed to update user profile access.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    console.log(`Profile ${userId} access updated with new products.`);

    // 7. Send "Acesso Liberado" email with login details
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY'); // Assuming Resend for email
    if (RESEND_API_KEY && profile.email && profile.cpf) {
      const emailSubject = "Seu acesso foi liberado!";
      const loginUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app')}/login`; // Construct login URL
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
          from: 'onboarding@resend.dev', // Replace with your verified sender email
          to: profile.email,
          subject: emailSubject,
          html: emailBody.replace(/\n/g, '<br/>'), // Convert newlines to HTML breaks
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        console.error('Error sending email via Resend:', errorData);
      } else {
        console.log(`Access liberation email sent to ${profile.email}`);
      }
    } else {
      console.warn('RESEND_API_KEY, user email, or CPF not available. Skipping email sending.');
    }

    // Return a 200 OK response to Asaas
    return new Response(JSON.stringify({ message: 'Webhook processed successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
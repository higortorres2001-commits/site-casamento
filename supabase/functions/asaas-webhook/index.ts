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

    // 4. Fetch the user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, access')
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
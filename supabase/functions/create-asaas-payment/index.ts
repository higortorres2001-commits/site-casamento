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
    const { userId, productIds } = await req.json();

    if (!userId || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return new Response(JSON.stringify({ error: 'Missing userId or productIds in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY not set in Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Fetch user profile (name, cpf, email)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, cpf, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching profile:', profileError);
      return new Response(JSON.stringify({ error: 'User profile not found.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Fetch product prices
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (productsError || !products || products.length !== productIds.length) {
      console.error('Error fetching products:', productsError);
      return new Response(JSON.stringify({ error: 'One or more products not found or an error occurred.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Calculate total price
    const totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);

    // 4. Insert new order with 'pending' status
    const { data: order, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: productIds,
        total_price: totalPrice,
        status: 'pending',
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      console.error('Error inserting order:', orderInsertError);
      return new Response(JSON.stringify({ error: 'Failed to create order.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Make request to Asaas API to create payment
    const asaasApiUrl = 'https://api.asaas.com/api/v3/payments';
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Asaas requires CPF/CNPJ without formatting
    const customerCpfCnpj = profile.cpf ? profile.cpf.replace(/[^0-9]/g, '') : null;

    const asaasPayload = {
      customer: {
        name: profile.name,
        email: profile.email,
        cpfCnpj: customerCpfCnpj,
      },
      billingType: 'PIX', // Defaulting to PIX, can be made dynamic if needed
      value: totalPrice,
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Due date for tomorrow
    };

    const asaasResponse = await fetch(asaasApiUrl, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(asaasPayload),
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas API error:', errorData);
      return new Response(JSON.stringify({ error: 'Failed to create payment with Asaas.', details: errorData }), {
        status: asaasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentData = await asaasResponse.json();

    // 6. Update order with asaas_payment_id
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: asaasPaymentData.id })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order with Asaas payment ID:', orderUpdateError);
      // Even if update fails, we still return Asaas data as payment was created
    }

    // Return Asaas response to the client
    return new Response(JSON.stringify(asaasPaymentData), {
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
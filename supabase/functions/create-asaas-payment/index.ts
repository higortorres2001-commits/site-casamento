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
    const { name, email, cpf, whatsapp, productIds, coupon_code } = requestBody; // Receive whatsapp

    if (!name || !email || !cpf || !whatsapp || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Missing name, email, cpf, whatsapp, or productIds in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing name, email, cpf, whatsapp, or productIds in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    if (!ASAAS_API_KEY) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'ASAAS_API_KEY not set in Supabase secrets.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY not set in Supabase secrets.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let isNewUser = false;

    // 1. Check if user exists by email
    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({
      email,
    });

    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to check for existing user.',
        metadata: { email, error: listUsersError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to check for existing user.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingUsers && existingUsers.users.length > 0) {
      // User exists
      userId = existingUsers.users[0].id;
      console.log(`Existing user found: ${userId}`);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: `Existing user found: ${userId}`,
        metadata: { email, userId }
      });

      // Update profile if necessary (e.g., name, cpf, email, whatsapp might be new/updated)
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ name, cpf, email, whatsapp }) // Update whatsapp
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating existing user profile:', updateProfileError);
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'create-asaas-payment',
          message: 'Error updating existing user profile.',
          metadata: { userId, error: updateProfileError.message }
        });
        // Continue even if profile update fails, as payment is primary goal
      }
    } else {
      // User does not exist, create new user
      isNewUser = true;
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: cpf, // CPF as password
        email_confirm: true, // Automatically confirm email
        user_metadata: { name, cpf, whatsapp }, // Store name, cpf, and whatsapp in user_metadata
      });

      if (createUserError || !newUser?.user) {
        console.error('Error creating new user:', createUserError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create new user account.',
          metadata: { email, error: createUserError?.message }
        });
        return new Response(JSON.stringify({ error: 'Failed to create new user account.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = newUser.user.id;
      console.log(`New user created: ${userId}`);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: `New user created: ${userId}`,
        metadata: { email, userId }
      });

      // The handle_new_user trigger should automatically insert into profiles.
      // If it doesn't, we would manually insert here.
      // For now, assuming the trigger is active and correctly populates profiles.
    }

    // 2. Fetch product prices
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price')
      .in('id', productIds);

    if (productsError || !products || products.length !== productIds.length) {
      console.error('Error fetching products:', productsError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'One or more products not found or an error occurred.',
        metadata: { productIds, error: productsError?.message }
      });
      return new Response(JSON.stringify({ error: 'One or more products not found or an error occurred.' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Calculate initial total price
    let totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);

    // 4. Apply coupon discount if coupon_code is provided
    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('code, discount_type, value, active')
        .eq('code', coupon_code)
        .eq('active', true)
        .single();

      if (couponError || !coupon) {
        console.error('Error fetching coupon or coupon not found/active:', couponError);
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'create-asaas-payment',
          message: 'Invalid or inactive coupon code.',
          metadata: { coupon_code, error: couponError?.message }
        });
        return new Response(JSON.stringify({ error: 'Invalid or inactive coupon code.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (coupon.discount_type === 'percentage') {
        totalPrice = totalPrice * (1 - (parseFloat(coupon.value) / 100));
      } else if (coupon.discount_type === 'fixed') {
        totalPrice = Math.max(0, totalPrice - parseFloat(coupon.value)); // Ensure price doesn't go below zero
      }
      console.log(`Coupon ${coupon_code} applied. New total price: ${totalPrice}`);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: `Coupon ${coupon_code} applied.`,
        metadata: { coupon_code, originalPrice: products.reduce((sum, p) => sum + parseFloat(p.price), 0), newPrice: totalPrice }
      });
    }

    // 5. Insert new order with 'pending' status
    const { data: order, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        user_id: userId, // Use the determined userId
        ordered_product_ids: productIds,
        total_price: totalPrice,
        status: 'pending',
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      console.error('Error inserting order:', orderInsertError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to create order.',
        metadata: { userId, productIds, totalPrice, error: orderInsertError?.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to create order.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    orderId = order.id;
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment',
      message: `Order created successfully: ${orderId}`,
      metadata: { orderId, userId, productIds, totalPrice }
    });

    // 6. Make request to Asaas API to create payment
    const asaasApiUrl = 'https://api.asaas.com/api/v3/payments';
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Asaas requires CPF/CNPJ without formatting
    const customerCpfCnpj = cpf.replace(/[^0-9]/g, '');

    // CRITICAL: Convert totalPrice from Reais to Centavos for Asaas API
    const totalPriceInCents = Math.round(totalPrice * 100);

    const asaasPayload = {
      customer: {
        name: name,
        email: email,
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp, // Pass whatsapp as phone to Asaas
      },
      billingType: 'PIX', // Defaulting to PIX, can be made dynamic if needed
      value: totalPriceInCents, // <-- AQUI! Use o valor em centavos
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
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to create payment with Asaas.',
        metadata: { orderId, userId, asaasPayload, asaasError: errorData, statusCode: asaasResponse.status }
      });
      return new Response(JSON.stringify({ error: 'Failed to create payment with Asaas.', details: errorData }), {
        status: asaasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentData = await asaasResponse.json();
    asaasPaymentId = asaasPaymentData.id;

    // 7. Update order with asaas_payment_id
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: asaasPaymentData.id })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order with Asaas payment ID:', orderUpdateError);
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment',
        message: 'Error updating order with Asaas payment ID.',
        metadata: { orderId, asaasPaymentId, error: orderUpdateError.message }
      });
      // Even if update fails, we still return Asaas data as payment was created
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment',
      message: `Asaas payment created successfully for order ${orderId}.`,
      metadata: { orderId, userId, asaasPaymentId, asaasPaymentData }
    });

    // Return Asaas response to the client
    return new Response(JSON.stringify(asaasPaymentData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        requestBody,
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
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
    console.log('create-asaas-payment: Received request body:', requestBody); // Log para depuração
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody; // Added metaTrackingData

    if (!name || !email || !cpf || !whatsapp || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Missing required fields (name, email, cpf, whatsapp, productIds) in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields (name, email, cpf, whatsapp, productIds) in request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!paymentMethod) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Payment method is missing from the request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Payment method is missing from the request body.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL'); // Get the base URL from environment variable

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

    if (!ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'ASAAS_API_URL not set in Supabase secrets. Please set it to https://api.asaas.com/v3 or your sandbox URL.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'ASAAS_API_URL not set in Supabase secrets. Please set it to https://api.asaas.com/v3 or your sandbox URL.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Check if user exists by email and create if not
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
        .update({ name, cpf, email, whatsapp })
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
        user_id: userId,
        ordered_product_ids: productIds,
        total_price: totalPrice,
        status: 'pending',
        // Store Meta tracking data with the order
        meta_tracking_data: metaTrackingData, 
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
      metadata: { orderId, userId, productIds, totalPrice, metaTrackingData }
    });

    // 6. Make request to Asaas API to create payment
    const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments`;
    const asaasTokenizeUrl = `${ASAAS_BASE_URL}/creditCard/tokenizeCreditCard`;

    console.log('Asaas Payments URL:', asaasPaymentsUrl); // Log the constructed URL
    console.log('Asaas Tokenize URL:', asaasTokenizeUrl); // Log the constructed URL

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Asaas requires CPF/CNPJ without formatting
    const customerCpfCnpj = cpf.replace(/[^0-9]/g, '');

    // Ensure total price is formatted to 2 decimal places for Asaas API
    const formattedTotalPrice = totalPrice.toFixed(2);

    let asaasPayload: any = {
      customer: {
        name: name,
        email: email,
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp,
      },
      value: parseFloat(formattedTotalPrice), // Asaas expects value in BRL (decimal)
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Due date for tomorrow
    };

    let finalAsaasResponseData: any;
    let clientResponseData: any; // This will hold the data sent back to the client

    if (paymentMethod === 'PIX') {
      asaasPayload.billingType = 'PIX';
      const asaasResponse = await fetch(asaasPaymentsUrl, { method: 'POST', headers: asaasHeaders, body: JSON.stringify(asaasPayload) });
      if (!asaasResponse.ok) {
        const contentType = asaasResponse.headers.get('Content-Type');
        let errorData: any;
        if (contentType && contentType.includes('application/json')) {
          errorData = await asaasResponse.json();
        } else {
          errorData = await asaasResponse.text();
        }
        console.error('Asaas PIX API error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create PIX payment with Asaas.',
          metadata: { orderId, userId, asaasPayload, asaasError: errorData, statusCode: asaasResponse.status }
        });
        return new Response(JSON.stringify({ error: 'Failed to create PIX payment with Asaas.', details: errorData }), {
          status: asaasResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      finalAsaasResponseData = await asaasResponse.json();
      asaasPaymentId = finalAsaasResponseData.id; // Get the payment ID from the initial response

      // Now, fetch the PIX QR Code details
      const pixQrCodeUrl = `${ASAAS_BASE_URL}/payments/${asaasPaymentId}/pixQrCode`;
      const pixQrCodeResponse = await fetch(pixQrCodeUrl, { method: 'GET', headers: asaasHeaders });

      if (!pixQrCodeResponse.ok) {
        const contentType = pixQrCodeResponse.headers.get('Content-Type');
        let errorData: any;
        if (contentType && contentType.includes('application/json')) {
          errorData = await pixQrCodeResponse.json();
        } else {
          errorData = await pixQrCodeResponse.text();
        }
        console.error('Asaas PIX QR Code API error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to fetch PIX QR Code from Asaas.',
          metadata: { orderId, userId, asaasPaymentId, asaasError: errorData, statusCode: pixQrCodeResponse.status }
        });
        return new Response(JSON.stringify({ error: 'Failed to fetch PIX QR Code from Asaas.', details: errorData }), {
          status: pixQrCodeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pixQrCodeData = await pixQrCodeResponse.json();
      
      // Construct the client response specifically for PIX as requested
      clientResponseData = {
        id: asaasPaymentId,
        orderId: order.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage,
      };
      console.log('PIX QR Code fetched successfully, client response prepared:', clientResponseData);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: 'PIX QR Code fetched successfully, client response prepared.',
        metadata: { orderId, userId, asaasPaymentId, clientResponse: clientResponseData }
      });

    } else if (paymentMethod === 'CREDIT_CARD') {
      if (!creditCard) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Credit card details are missing for CREDIT_CARD payment method.',
          metadata: { requestBody }
        });
        return new Response(JSON.stringify({ error: 'Credit card details are missing for CREDIT_CARD payment method.' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Step A: Tokenize Credit Card (Backend-side)
      const tokenizePayload = {
        customer: {
          name: name,
          email: email,
          cpfCnpj: customerCpfCnpj,
          phone: whatsapp,
        },
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.cardNumber.replace(/\s/g, ''), // Remove spaces
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv,
        },
      };

      const tokenizeResponse = await fetch(asaasTokenizeUrl, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(tokenizePayload),
      });

      if (!tokenizeResponse.ok) {
        const errorData = await tokenizeResponse.json();
        console.error('Asaas Tokenization API error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to tokenize credit card with Asaas.',
          metadata: { orderId, userId, tokenizePayload, asaasError: errorData, statusCode: tokenizeResponse.status }
        });
        return new Response(JSON.stringify({ error: 'Failed to tokenize credit card with Asaas.', details: errorData }), {
          status: tokenizeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenizeData = await tokenizeResponse.json();
      const creditCardToken = tokenizeData.creditCardToken;
      console.log('Credit card tokenized successfully:', creditCardToken);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: 'Credit card tokenized successfully.',
        metadata: { orderId, userId, creditCardToken }
      });

      // Step B: Create Payment with Token
      asaasPayload.billingType = 'CREDIT_CARD';
      asaasPayload.creditCardToken = creditCardToken;
      asaasPayload.remoteIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'; // Get client IP
      asaasPayload.callbackUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app')}/confirmacao`; // Optional callback
      asaasPayload.returnUrl = `${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app')}/confirmacao`; // Optional return URL

      const asaasPaymentResponse = await fetch(asaasPaymentsUrl, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(asaasPayload),
      });

      if (!asaasPaymentResponse.ok) {
        const errorData = await asaasPaymentResponse.json();
        console.error('Asaas Payment API error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create credit card payment with Asaas.',
          metadata: { orderId, userId, asaasPayload, asaasError: errorData, statusCode: asaasPaymentResponse.status }
        });
        return new Response(JSON.stringify({ error: 'Failed to create credit card payment with Asaas.', details: errorData }), {
          status: tokenizeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      finalAsaasResponseData = await asaasPaymentResponse.json();
      // For credit card, the client response can be the full Asaas response + our orderId
      clientResponseData = { ...finalAsaasResponseData, orderId: order.id };

    } else {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Invalid payment method provided.',
        metadata: { paymentMethod, requestBody }
      });
      return new Response(JSON.stringify({ error: 'Invalid payment method provided.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If asaasPaymentId was not set in the PIX block, set it here for credit card
    if (!asaasPaymentId && finalAsaasResponseData.id) {
      asaasPaymentId = finalAsaasResponseData.id;
    }

    // 7. Update order with asaas_payment_id
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: asaasPaymentId })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order with Asaas payment ID:', orderUpdateError);
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment',
        message: 'Error updating order with Asaas payment ID.',
        metadata: { orderId, asaasPaymentId, error: orderUpdateError.message }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment',
      message: `Asaas payment created successfully for order ${orderId}.`,
      metadata: { orderId, userId, asaasPaymentId, asaasPaymentData: finalAsaasResponseData }
    });

    // Return the prepared clientResponseData
    return new Response(JSON.stringify(clientResponseData), {
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
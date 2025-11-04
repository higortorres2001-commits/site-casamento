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
    console.log('create-asaas-payment: Received request body:', JSON.stringify(requestBody));
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'Edge function invoked',
      metadata: { requestBody }
    });

    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Missing required fields',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields (name, email, cpf, whatsapp, productIds)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!paymentMethod) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Payment method is missing',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Payment method is missing' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'ASAAS credentials not configured',
        metadata: { hasApiKey: !!ASAAS_API_KEY, hasBaseUrl: !!ASAAS_BASE_URL }
      });
      return new Response(JSON.stringify({ error: 'ASAAS credentials not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limpar CPF - remover qualquer formatação
    const cleanCpf = cpf.replace(/[^0-9]/g, '');
    console.log('Cleaned CPF for password:', cleanCpf);

    // Check if user exists
    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ email });

    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to check for existing user',
        metadata: { email, error: listUsersError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to check for existing user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existingUsers && existingUsers.users.length > 0) {
      userId = existingUsers.users[0].id;
      console.log(`Existing user found: ${userId}`);
      
      // ATUALIZAR PERFIL SEMPRE - garantir que CPF esteja correto
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ name, cpf: cleanCpf, email, whatsapp })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating profile:', updateProfileError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to update profile',
          metadata: { userId, error: updateProfileError.message }
        });
      }

      // IMPORTANTE: Resetar senha para o CPF limpo sempre que encontrar usuário existente
      console.log('Resetting password for existing user to CPF:', cleanCpf);
      const { error: resetPasswordError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: cleanCpf }
      );

      if (resetPasswordError) {
        console.error('Error resetting password:', resetPasswordError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to reset password for existing user',
          metadata: { userId, error: resetPasswordError.message }
        });
      } else {
        console.log('Password reset successfully for existing user');
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment',
          message: 'Password reset for existing user',
          metadata: { userId, email, cpfLength: cleanCpf.length }
        });
      }
    } else {
      // Criar usuário com CPF limpo (apenas números) como senha
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: cleanCpf, // Usar CPF limpo como senha
        email_confirm: true,
        user_metadata: { name, cpf: cleanCpf, whatsapp },
      });

      if (createUserError || !newUser?.user) {
        console.error('Error creating user:', createUserError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create user',
          metadata: { email, cpf: cleanCpf, error: createUserError?.message }
        });
        return new Response(JSON.stringify({ error: 'Failed to create user account' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = newUser.user.id;
      console.log(`New user created: ${userId} with password: ${cleanCpf}`);
      
      // Criar perfil para o novo usuário
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name,
          cpf: cleanCpf,
          email,
          whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create profile',
          metadata: { userId, error: profileError.message }
        });
      }
      
      // Log para debug
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment',
        message: 'New user created with CPF as password',
        metadata: { userId, email, cpfLength: cleanCpf.length, passwordSet: cleanCpf }
      });
    }

    // --- Product Validation with Detailed Logging ---
    const uniqueProductIds = [...new Set(productIds)];
    console.log('Unique product IDs to fetch:', uniqueProductIds);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-product-fetch',
      message: 'Attempting to fetch products',
      metadata: { uniqueProductIds }
    });

    // Fetch products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status') // Added name and status for debugging
      .in('id', uniqueProductIds);

    console.log('Supabase response for products:', { data: products, error: productsError });

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-product-fetch',
      message: 'Supabase response for product fetch',
      metadata: { 
        requestedIds: uniqueProductIds,
        foundProducts: products,
        error: productsError?.message,
        productsCount: products?.length || 0,
        requestedCount: uniqueProductIds.length
      }
    });

    if (productsError || !products || products.length !== uniqueProductIds.length) {
      console.error('Error fetching products:', productsError);
      
      // Determine which IDs were not found
      const foundIds = new Set(products?.map(p => p.id) || []);
      const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));

      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Products not found',
        metadata: { 
          productIds: uniqueProductIds, 
          missingIds, 
          foundIds: Array.from(foundIds),
          error: productsError?.message 
        }
      });
      return new Response(JSON.stringify({ error: 'One or more products not found', details: { missingIds } }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // --- End Product Validation Fix ---

    let totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);

    // Apply coupon
    if (coupon_code) {
      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('code, discount_type, value, active')
        .eq('code', coupon_code)
        .eq('active', true)
        .single();

      if (couponError || !coupon) {
        console.error('Invalid coupon:', couponError);
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'create-asaas-payment',
          message: 'Invalid coupon code',
          metadata: { coupon_code, error: couponError?.message }
        });
        return new Response(JSON.stringify({ error: 'Invalid or inactive coupon code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (coupon.discount_type === 'percentage') {
        totalPrice = totalPrice * (1 - (parseFloat(coupon.value) / 100));
      } else if (coupon.discount_type === 'fixed') {
        totalPrice = Math.max(0, totalPrice - parseFloat(coupon.value));
      }
      console.log(`Coupon applied. New total: ${totalPrice}`);
    }

    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const clientUserAgent = req.headers.get('user-agent') || '';

    const fullMetaTrackingData = {
      ...metaTrackingData,
      client_ip_address: clientIpAddress,
      client_user_agent: clientUserAgent,
    };

    // Create order
    const { data: order, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: productIds, // Keep original list including duplicates for order tracking
        total_price: totalPrice,
        status: 'pending',
        meta_tracking_data: fullMetaTrackingData,
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      console.error('Error creating order:', orderInsertError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to create order',
        metadata: { userId, productIds, error: orderInsertError?.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to create order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    orderId = order.id;
    console.log(`Order created: ${orderId}`);

    // Create Asaas payment
    const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments`;
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    const customerCpfCnpj = cleanCpf; // Usar CPF já limpo
    const formattedTotalPrice = totalPrice.toFixed(2);

    let asaasPayload: any = {
      customer: {
        name: name,
        email: email,
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp,
      },
      value: parseFloat(formattedTotalPrice),
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    };

    let finalAsaasResponseData: any;
    let clientResponseData: any;

    if (paymentMethod === 'PIX') {
      asaasPayload.billingType = 'PIX';
      
      console.log('Creating PIX payment with Asaas:', asaasPayload);
      
      const asaasResponse = await fetch(asaasPaymentsUrl, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(asaasPayload)
      });

      if (!asaasResponse.ok) {
        const errorData = await asaasResponse.json();
        console.error('Asaas PIX error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create PIX payment',
          metadata: { orderId, asaasPayload, asaasError: errorData }
        });
        return new Response(JSON.stringify({ error: 'Failed to create PIX payment', details: errorData }), {
          status: asaasResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalAsaasResponseData = await asaasResponse.json();
      asaasPaymentId = finalAsaasResponseData.id;

      const pixQrCodeUrl = `${ASAAS_BASE_URL}/payments/${asaasPaymentId}/pixQrCode`;
      const pixQrCodeResponse = await fetch(pixQrCodeUrl, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (!pixQrCodeResponse.ok) {
        const errorData = await pixQrCodeResponse.json();
        console.error('Asaas PIX QR Code error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to fetch PIX QR Code',
          metadata: { orderId, asaasPaymentId, asaasError: errorData }
        });
        return new Response(JSON.stringify({ error: 'Failed to fetch PIX QR Code', details: errorData }), {
          status: pixQrCodeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pixQrCodeData = await pixQrCodeResponse.json();
      clientResponseData = {
        id: asaasPaymentId,
        orderId: order.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage,
      };

    } else if (paymentMethod === 'CREDIT_CARD') {
      if (!creditCard) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Credit card details missing',
          metadata: { requestBody }
        });
        return new Response(JSON.stringify({ error: 'Credit card details are missing' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      asaasPayload.billingType = 'CREDIT_CARD';
      asaasPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.cardNumber.replace(/\s/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      };
      asaasPayload.creditCardHolderInfo = {
        name: name,
        email: email,
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp,
        postalCode: creditCard.postalCode.replace(/\D/g, ''),
        addressNumber: creditCard.addressNumber,
      };

      if (creditCard.installmentCount && creditCard.installmentCount > 1) {
        asaasPayload.installmentCount = creditCard.installmentCount;
        asaasPayload.installmentValue = parseFloat((totalPrice / creditCard.installmentCount).toFixed(2));
      }

      asaasPayload.remoteIp = clientIpAddress;

      console.log('Creating credit card payment with Asaas');

      const asaasPaymentResponse = await fetch(asaasPaymentsUrl, {
        method: 'POST',
        headers: asaasHeaders,
        body: JSON.stringify(asaasPayload),
      });

      if (!asaasPaymentResponse.ok) {
        const errorData = await asaasPaymentResponse.json();
        console.error('Asaas credit card error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create credit card payment',
          metadata: { orderId, asaasPayload, asaasError: errorData }
        });
        return new Response(JSON.stringify({ error: 'Failed to create credit card payment', details: errorData }), {
          status: asaasPaymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalAsaasResponseData = await asaasPaymentResponse.json();
      clientResponseData = { ...finalAsaasResponseData, orderId: order.id };
    } else {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Invalid payment method',
        metadata: { paymentMethod }
      });
      return new Response(JSON.stringify({ error: 'Invalid payment method' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!asaasPaymentId && finalAsaasResponseData.id) {
      asaasPaymentId = finalAsaasResponseData.id;
    }

    // Update order with payment ID
    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: asaasPaymentId })
      .eq('id', order.id);

    if (orderUpdateError) {
      console.error('Error updating order:', orderUpdateError);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment',
      message: 'Payment created successfully',
      metadata: { orderId, asaasPaymentId, paymentMethod }
    });

    return new Response(JSON.stringify(clientResponseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment',
      message: `Unhandled error: ${error.message}`,
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
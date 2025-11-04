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
      metadata: { 
        requestBody: {
          ...requestBody,
          // Remover dados sensíveis do log
          creditCard: requestBody.creditCard ? 'PRESENT' : 'NOT_PRESENT',
          password: 'REDACTED'
        }
      }
    });

    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation',
        message: 'Missing required fields',
        metadata: { 
          hasName: !!name,
          hasEmail: !!email,
          hasCpf: !!cpf,
          hasWhatsapp: !!whatsapp,
          hasProductIds: !!productIds,
          productIdsLength: productIds?.length || 0
        }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields (name, email, cpf, whatsapp, productIds)' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!paymentMethod) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation',
        message: 'Payment method is missing',
        metadata: { paymentMethod }
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
        context: 'create-asaas-payment-config',
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

    // ETAPA 1: Verificar existência de usuário com logging detalhado
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-lookup-start',
      message: 'Starting user lookup process',
      metadata: { email, cleanCpfLength: cleanCpf.length }
    });

    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ 
      email: email.toLowerCase().trim() 
    });

    if (listUsersError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-lookup-error',
        message: 'Failed to check for existing user',
        metadata: { 
          email: email.toLowerCase().trim(), 
          error: listUsersError.message,
          errorType: listUsersError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to check for existing user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = existingUsers.users && existingUsers.users.length > 0 ? existingUsers.users[0] : null;
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-lookup-result',
      message: existingUser ? 'Existing user found' : 'No existing user found',
      metadata: { 
        email: email.toLowerCase().trim(),
        existingUserId: existingUser?.id || null,
        existingUserEmail: existingUser?.email || null,
        totalUsersFound: existingUsers.users?.length || 0
      }
    });

    if (existingUser) {
      userId = existingUser.id;
      console.log(`Existing user found: ${userId}`);
      
      // ETAPA 2: Atualizar perfil do usuário existente
      await supabase.from('logs').insert({
        level: 'info',
        context: 'profile-update-start',
        message: 'Updating existing user profile',
        metadata: { userId, email, name }
      });

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ 
          name, 
          cpf: cleanCpf, 
          email: email.toLowerCase().trim(), 
          whatsapp: whatsapp.replace(/\D/g, ''),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (updateProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'profile-update-error',
          message: 'Failed to update existing user profile',
          metadata: { 
            userId, 
            email, 
            error: updateProfileError.message,
            errorType: updateProfileError.name,
            errorCode: updateProfileError.code
          }
        });
        // Continuar mesmo com erro de update - o pagamento ainda pode ser processado
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'profile-update-success',
          message: 'Existing user profile updated successfully',
          metadata: { userId, email, name }
        });
      }
    } else {
      // ETAPA 3: Criar novo usuário
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-creation-start',
        message: 'Starting new user creation',
        metadata: { 
          email: email.toLowerCase().trim(), 
          name,
          cleanCpfLength: cleanCpf.length,
          passwordLength: cleanCpf.length
        }
      });

      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: cleanCpf, // Usar CPF limpo como senha
        email_confirm: true,
        user_metadata: { 
          name, 
          cpf: cleanCpf, 
          whatsapp: whatsapp.replace(/\D/g, ''),
          created_via: 'checkout'
        },
      });

      if (createUserError || !newUser?.user) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-creation-error',
          message: 'Failed to create new user',
          metadata: { 
            email: email.toLowerCase().trim(), 
            cpfLength: cleanCpf.length,
            error: createUserError?.message,
            errorType: createUserError?.name,
            errorCode: createUserError?.code,
            errorDetails: createUserError
          }
        });
        return new Response(JSON.stringify({ 
          error: 'Failed to create user account',
          details: createUserError?.message 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      userId = newUser.user.id;
      console.log(`New user created: ${userId} with password length: ${cleanCpf.length}`);
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-creation-success',
        message: 'New user created successfully',
        metadata: { 
          userId, 
          email: email.toLowerCase().trim(), 
          name,
          passwordLength: cleanCpf.length
        }
      });
      
      // ETAPA 4: Criar perfil para o novo usuário
      await supabase.from('logs').insert({
        level: 'info',
        context: 'profile-creation-start',
        message: 'Creating profile for new user',
        metadata: { userId, email, name }
      });

      const { error: profileError, data: profileData } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name,
          cpf: cleanCpf,
          email: email.toLowerCase().trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (profileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'profile-creation-error',
          message: 'Failed to create profile for new user',
          metadata: { 
            userId, 
            email, 
            error: profileError.message,
            errorType: profileError.name,
            errorCode: profileError.code
          }
        });
        // Não falhar completamente - o usuário foi criado no auth
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'profile-creation-success',
          message: 'Profile created successfully for new user',
          metadata: { userId, profileId: profileData?.id }
        });
      }
    }

    // ETAPA 5: Validação de produtos com logging detalhado
    const uniqueProductIds = [...new Set(productIds)];
    console.log('Unique product IDs to fetch:', uniqueProductIds);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'product-validation-start',
      message: 'Starting product validation',
      metadata: { 
        originalProductIds: productIds,
        uniqueProductIds,
        requestedCount: uniqueProductIds.length
      }
    });

    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', uniqueProductIds);

    if (productsError || !products || products.length !== uniqueProductIds.length) {
      const foundIds = new Set(products?.map(p => p.id) || []);
      const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));

      await supabase.from('logs').insert({
        level: 'error',
        context: 'product-validation-error',
        message: 'Product validation failed',
        metadata: { 
          requestedIds: uniqueProductIds,
          foundIds: Array.from(foundIds),
          missingIds,
          error: productsError?.message,
          productsCount: products?.length || 0,
          requestedCount: uniqueProductIds.length
        }
      });
      return new Response(JSON.stringify({ 
        error: 'One or more products not found', 
        details: { missingIds } 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'product-validation-success',
      message: 'All products validated successfully',
      metadata: { 
        validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price })),
        totalProducts: products.length
      }
    });

    // ETAPA 6: Cálculo do preço com cupom
    let totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price), 0);

    if (coupon_code) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'coupon-validation-start',
        message: 'Validating coupon code',
        metadata: { coupon_code, originalTotal: totalPrice }
      });

      const { data: coupon, error: couponError } = await supabase
        .from('coupons')
        .select('code, discount_type, value, active')
        .eq('code', coupon_code.toUpperCase().trim())
        .eq('active', true)
        .single();

      if (couponError || !coupon) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'coupon-validation-error',
          message: 'Invalid or inactive coupon code',
          metadata: { 
            coupon_code: coupon_code.toUpperCase().trim(),
            error: couponError?.message,
            errorType: couponError?.name
          }
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
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'coupon-validation-success',
        message: 'Coupon applied successfully',
        metadata: { 
          coupon_code: coupon.code,
          discount_type: coupon.discount_type,
          discount_value: coupon.value,
          originalTotal: products.reduce((sum, product) => sum + parseFloat(product.price), 0),
          finalTotal: totalPrice
        }
      });
    }

    // ETAPA 7: Criação do pedido
    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const clientUserAgent = req.headers.get('user-agent') || '';

    const fullMetaTrackingData = {
      ...metaTrackingData,
      client_ip_address: clientIpAddress,
      client_user_agent: clientUserAgent,
    };

    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-creation-start',
      message: 'Creating order',
      metadata: { 
        userId, 
        productIds, 
        totalPrice,
        paymentMethod,
        hasCoupon: !!coupon_code
      }
    });

    const { data: order, error: orderInsertError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: productIds,
        total_price: totalPrice,
        status: 'pending',
        meta_tracking_data: fullMetaTrackingData,
      })
      .select()
      .single();

    if (orderInsertError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'order-creation-error',
        message: 'Failed to create order',
        metadata: { 
          userId, 
          productIds, 
          totalPrice,
          error: orderInsertError?.message,
          errorType: orderInsertError?.name,
          errorCode: orderInsertError?.code
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to create order' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    orderId = order.id;
    console.log(`Order created: ${orderId}`);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-creation-success',
      message: 'Order created successfully',
      metadata: { 
        orderId, 
        userId, 
        totalPrice,
        status: order.status
      }
    });

    // ETAPA 8: Processamento do pagamento com Asaas
    const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments`;
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    const customerCpfCnpj = cleanCpf;
    const formattedTotalPrice = totalPrice.toFixed(2);

    let asaasPayload: any = {
      customer: {
        name: name,
        email: email.toLowerCase().trim(),
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp.replace(/\D/g, ''),
      },
      value: parseFloat(formattedTotalPrice),
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    };

    let finalAsaasResponseData: any;
    let clientResponseData: any;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'asaas-payment-start',
      message: 'Starting As
<think></think>
<dyad-write path="supabase/functions/create-asaas-payment/index.ts" description="Continuação do arquivo com logging detalhado">
as payment processing',
      metadata: { 
        paymentMethod,
        asaasPayload: {
          ...asaasPayload,
          // Remover dados sensíveis
          customer: {
            name: asaasPayload.customer.name,
            email: asaasPayload.customer.email,
            hasCpfCnpj: !!asaasPayload.customer.cpfCnpj,
            hasPhone: !!asaasPayload.customer.phone
          },
          value: asaasPayload.value,
          billingType: asaasPayload.billingType
        }
      }
    });

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
          context: 'asaas-pix-error',
          message: 'Failed to create PIX payment',
          metadata: { 
            orderId, 
            asaasPayload: {
              ...asaasPayload,
              customer: { name: asaasPayload.customer.name, email: asaasPayload.customer.email }
            },
            asaasError: errorData,
            httpStatus: asaasResponse.status,
            httpStatusText: asaasResponse.statusText
          }
        });
        return new Response(JSON.stringify({ error: 'Failed to create PIX payment', details: errorData }), {
          status: asaasResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalAsaasResponseData = await asaasResponse.json();
      asaasPaymentId = finalAsaasResponseData.id;

      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-pix-success',
        message: 'PIX payment created successfully',
        metadata: { 
          orderId, 
          asaasPaymentId,
          asaasResponse: {
            id: finalAsaasResponseData.id,
            status: finalAsaasResponseData.status
          }
        }
      });

      const pixQrCodeUrl = `${ASAAS_BASE_URL}/payments/${asaasPaymentId}/pixQrCode`;
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-pix-qrcode-start',
        message: 'Fetching PIX QR Code',
        metadata: { asaasPaymentId, pixQrCodeUrl }
      });

      const pixQrCodeResponse = await fetch(pixQrCodeUrl, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (!pixQrCodeResponse.ok) {
        const errorData = await pixQrCodeResponse.json();
        console.error('Asaas PIX QR Code error:', errorData);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'asaas-pix-qrcode-error',
          message: 'Failed to fetch PIX QR Code',
          metadata: { 
            orderId, 
            asaasPaymentId, 
            asaasError: errorData,
            httpStatus: pixQrCodeResponse.status
          }
        });
        return new Response(JSON.stringify({ error: 'Failed to fetch PIX QR Code', details: errorData }), {
          status: pixQrCodeResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const pixQrCodeData = await pixQrCodeResponse.json();
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-pix-qrcode-success',
        message: 'PIX QR Code fetched successfully',
        metadata: { 
          orderId, 
          asaasPaymentId,
          hasPayload: !!pixQrCodeData.payload,
          hasEncodedImage: !!pixQrCodeData.encodedImage
        }
      });

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
          context: 'credit-card-validation-error',
          message: 'Credit card details missing',
          metadata: { 
            orderId, 
            hasCreditCard: !!creditCard,
            paymentMethod 
          }
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
        email: email.toLowerCase().trim(),
        cpfCnpj: customerCpfCnpj,
        phone: whatsapp.replace(/\D/g, ''),
        postalCode: creditCard.postalCode.replace(/\D/g, ''),
        addressNumber: creditCard.addressNumber,
      };

      if (creditCard.installmentCount && creditCard.installmentCount > 1) {
        asaasPayload.installmentCount = creditCard.installmentCount;
        asaasPayload.installmentValue = parseFloat((totalPrice / creditCard.installmentCount).toFixed(2));
      }

      asaasPayload.remoteIp = clientIpAddress;

      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-credit-card-start',
        message: 'Starting credit card payment processing',
        metadata: { 
          orderId,
          installmentCount: creditCard.installmentCount || 1,
          hasInstallments: (creditCard.installmentCount || 1) > 1,
          remoteIp: clientIpAddress
        }
      });

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
          context: 'asaas-credit-card-error',
          message: 'Failed to create credit card payment',
          metadata: { 
            orderId, 
            asaasPayload: {
              ...asaasPayload,
              creditCard: {
                holderName: creditCard.holderName,
                number: '****-****-****-' + creditCard.cardNumber.slice(-4),
                expiryMonth: creditCard.expiryMonth,
                expiryYear: creditCard.expiryYear
              }
            },
            asaasError: errorData,
            httpStatus: asaasPaymentResponse.status
          }
        });
        return new Response(JSON.stringify({ error: 'Failed to create credit card payment', details: errorData }), {
          status: asaasPaymentResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalAsaasResponseData = await asaasPaymentResponse.json();
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'asaas-credit-card-success',
        message: 'Credit card payment created successfully',
        metadata: { 
          orderId, 
          asaasPaymentId: finalAsaasResponseData.id,
          status: finalAsaasResponseData.status,
          authorizationCode: finalAsaasResponseData.authorizationCode
        }
      });

      clientResponseData = { ...finalAsaasResponseData, orderId: order.id };
    } else {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'payment-method-error',
        message: 'Invalid payment method',
        metadata: { paymentMethod, orderId }
      });
      return new Response(JSON.stringify({ error: 'Invalid payment method' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!asaasPaymentId && finalAsaasResponseData.id) {
      asaasPaymentId = finalAsaasResponseData.id;
    }

    // ETAPA 9: Atualizar pedido com ID do pagamento
    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-update-start',
      message: 'Updating order with payment ID',
      metadata: { orderId, asaasPaymentId }
    });

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: asaasPaymentId })
      .eq('id', order.id);

    if (orderUpdateError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'order-update-error',
        message: 'Failed to update order with payment ID',
        metadata: { 
          orderId, 
          asaasPaymentId,
          error: orderUpdateError.message,
          errorType: orderUpdateError.name
        }
      });
      // Não falhar completamente - o pagamento foi criado
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'order-update-success',
        message: 'Order updated successfully with payment ID',
        metadata: { orderId, asaasPaymentId }
      });
    }

    // ETAPA 10: Log final de sucesso
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'Payment process completed successfully',
      metadata: { 
        orderId, 
        userId, 
        asaasPaymentId, 
        paymentMethod,
        totalPrice,
        wasExistingUser: !!existingUser,
        productCount: uniqueProductIds.length
      }
    });

    return new Response(JSON.stringify(clientResponseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-unhandled-error',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        requestBody: {
          ...requestBody,
          // Remover dados sensíveis
          creditCard: requestBody.creditCard ? 'PRESENT' : 'NOT_PRESENT',
          password: 'REDACTED'
        }
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
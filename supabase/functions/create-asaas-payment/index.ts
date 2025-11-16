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

  try {
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'Starting CORRECTED payment creation - preventing duplicate product IDs',
      metadata: { 
        email: email.toLowerCase().trim(),
        productIds: productIds,
        productCount: productIds.length,
        uniqueProductIds: [...new Set(productIds)].length,
        paymentMethod
      }
    });

    // VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS
    const missingFields = [];
    if (!name) missingFields.push('name');
    if (!email) missingFields.push('email');
    if (!cpf) missingFields.push('cpf');
    if (!whatsapp) missingFields.push('whatsapp');
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) missingFields.push('productIds');
    if (!paymentMethod) missingFields.push('paymentMethod');

    if (missingFields.length > 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation-error',
        message: 'Missing required fields in request',
        metadata: { missingFields, receivedFields: Object.keys(req.body) }
      });
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // VALIDAÇÃO DE MÉTODO DE PAGAMENTO
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation-error',
        message: 'Invalid payment method',
        metadata: { paymentMethod, validMethods: ['PIX', 'CREDIT_CARD'] }
      });
      throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
    }

    // VALIDAÇÃO ESPECÍFICA PARA CARTÃO DE CRÉDITO
    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation-error',
        message: 'Credit card data missing for CREDIT_CARD payment',
        metadata: { paymentMethod, hasCreditCard: !!creditCard }
      });
      throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-validation-success',
      message: 'Request validation completed successfully',
      metadata: { 
        email: email.toLowerCase().trim(),
        paymentMethod,
        productCount: productIds.length,
        uniqueProductIds: [...new Set(productIds)].length,
        hasCoupon: !!coupon_code
      }
    });

    // CORREÇÃO: Usar Set para eliminar duplicatas e garantir IDs únicos
    const uniqueProductIds = [...new Set(productIds)];
    
    if (uniqueProductIds.length !== productIds.length) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment-duplicates-removed',
        message: 'Duplicate product IDs detected and removed',
        metadata: { 
          originalCount: productIds.length,
          uniqueCount: uniqueProductIds.length,
          duplicatesRemoved: productIds.length - uniqueProductIds.length,
          originalIds: productIds,
          uniqueIds: uniqueProductIds
        }
      });
    }

    // VALIDAÇÃO DE PRODUTOS
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', uniqueProductIds);

    if (productsError || !products) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-product-validation-error',
        message: 'Database error while fetching products',
        metadata: { 
          requestedIds: uniqueProductIds,
          error: productsError.message,
          errorCode: productsError.code
        }
      });
      throw new Error('Produtos não encontrados: ' + (productsError?.message || 'Erro desconhecido'));
    }

    if (products.length !== uniqueProductIds.length) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-product-missing-error',
        message: 'Some requested products were not found',
        metadata: { 
          requestedIds: uniqueProductIds,
          foundIds: products.map(p => p.id),
          foundCount: products.length,
          requestedCount: uniqueProductIds.length,
          missingIds: uniqueProductIds.filter(id => !products.map(p => p.id).includes(id))
        }
      });
      throw new Error(`Produtos não encontrados: ${uniqueProductIds.filter(id => !products.map(p => p.id).includes(id)).join(', ')}`);
    }

    // Verificar se todos os produtos estão ativos
    const inactiveProducts = products.filter(p => p.status !== 'ativo');
    if (inactiveProducts.length > 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-product-inactive-error',
        message: 'Some requested products are not active',
        metadata: { 
          inactiveProducts: inactiveProducts.map(p => ({ id: p.id, name: p.name, status: p.status }))
        }
      });
      throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-product-validation-success',
      message: 'All products validated successfully',
      metadata: { 
        validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price, status: p.status })),
        requestedCount: uniqueProductIds.length,
        foundCount: products.length
      }
    });

    // CRIAÇÃO DO USUÁRIO (Mantendo lógica existente)
    let userId: string;
    
    try {
      // Verificar se usuário já existe no Auth
      const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        userId = existingUser.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-existing-user-found',
          message: 'Found existing user in Auth, updating profile',
          metadata: { 
            userId,
            email: email.toLowerCase().trim(),
            existingUserCreated: existingUser.created_at
          }
        });

        // Atualizar perfil do usuário existente
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ 
            name, 
            cpf: cpf, 
            email: email.toLowerCase().trim(), 
            whatsapp: whatsapp,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateProfileError) {
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'create-asaas-payment-profile-update-error',
            message: 'Failed to update existing user profile, but continuing',
            metadata: { 
              userId,
              error: updateProfileError.message,
              errorCode: updateProfileError.code
            }
          });
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'create-asaas-payment-profile-updated',
            message: 'Existing user profile updated successfully',
            metadata: { userId }
          });
        }
      } else {
        // Criar NOVO usuário (Auth + Profile)
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-creating-new-user',
          message: 'Creating new user account (Auth + Profile)',
          metadata: { 
            email: email.toLowerCase().trim(),
            cpfLength: cpf.length,
            flow: 'checkout'
          }
        });

        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: email.toLowerCase().trim(),
          password: cpf,
          email_confirm: true,
          user_metadata: { 
            name, 
            cpf: cpf, 
            whatsapp: whatsapp,
            created_via: 'checkout'
          },
        });

        if (createUserError || !newUser?.user) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'create-asaas-payment-auth-creation-error',
            message: 'CRITICAL: Failed to create Auth user in checkout',
            metadata: { 
              email: email.toLowerCase().trim(),
              error: createUserError?.message,
              errorType: createUserError?.name,
              flow: 'checkout'
            }
          });
          throw new Error('Erro ao criar conta de usuário: ' + (createUserError?.message || 'Erro desconhecido'));
        }

        userId = newUser.user.id;

        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-auth-created',
          message: 'Auth user created successfully in checkout',
          metadata: { 
            userId,
            email: email.toLowerCase().trim(),
            flow: 'checkout'
          }
        });

        // Criar perfil IMEDIATAMENTE
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            name: name,
            cpf: cpf,
            email: email.toLowerCase().trim(),
            whatsapp: whatsapp,
            access: [], // Vazio - acesso será liberado pelo webhook
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          });

        if (profileError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'create-asaas-payment-profile-creation-error',
            message: 'CRITICAL: Failed to create profile for new user in checkout',
            metadata: { 
              userId,
              email: email.toLowerCase().trim(),
              error: profileError.message,
              errorCode: profileError.code,
              flow: 'checkout'
            }
          });
          
          // Tentar deletar o usuário do Auth para evitar inconsistência
          await supabase.auth.admin.deleteUser(userId);
          
          throw new Error('Erro ao criar perfil do usuário: ' + profileError.message);
        }

        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-profile-created',
          message: 'Profile created successfully for new user in checkout (access empty, will be granted by webhook)',
          metadata: { 
            userId,
            email: email.toLowerCase().trim(),
            flow: 'checkout'
          }
        });
      }
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-user-management-error',
        message: `Error in user management: ${error.message}`,
        metadata: { 
          email: email.toLowerCase().trim(),
          error: error.message,
          errorStack: error.stack
        }
      });
      throw new Error('Erro no gerenciamento de usuário: ' + error.message);
    }

    // CRIAÇÃO DO PEDIDO (usando IDs únicos)
    const originalTotal = products.reduce((sum: number, product: any) => sum + parseFloat(product.price), 0);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-order-creation',
      message: 'Creating order with unique product IDs',
      metadata: { 
        userId,
        uniqueProductIds: uniqueProductIds,
        originalTotal,
        productCount: uniqueProductIds.length
      }
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: uniqueProductIds, // CORREÇÃO: Usar array sem duplicatas
        total_price: originalTotal,
        status: 'pending',
        meta_tracking_data: {
          ...metaTrackingData,
          client_ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
          client_user_agent: req.headers.get('user-agent') || ''
        }
      })
      .select()
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-order-creation-error',
        message: 'Failed to create order in database',
        metadata: { 
          userId,
          uniqueProductIds,
          originalTotal,
          error: orderError?.message,
          errorCode: orderError?.code
        }
      });
      throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-order-created',
      message: 'Order created successfully',
      metadata: { 
        orderId: order.id,
        userId,
        uniqueProductIds,
        originalTotal,
        status: order.status
      }
    });

    // PROCESSAMENTO DO PAGAMENTO (mantendo lógica existente)
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-config-error',
        message: 'Asaas API credentials not configured',
        metadata: { 
          hasApiKey: !!ASAAS_API_KEY,
          hasBaseUrl: !!ASAAS_BASE_URL
        }
      });
      throw new Error('Configuração de pagamento não encontrada');
    }

    const asaasPayload = {
      customer: {
        name: name,
        email: email,
        cpfCnpj: cpf,
        phone: whatsapp,
      },
      value: parseFloat(originalTotal.toFixed(2)),
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      billingType: 'PIX',
    };

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Criar pagamento PIX
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(asaasPayload)
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-pix-creation-error',
        message: 'Failed to create PIX payment with Asaas',
        metadata: { 
          orderId: order.id,
          asaasError: errorData,
          httpStatus: asaasResponse.status,
          httpStatusText: asaasResponse.statusText
        }
      });
      throw new Error('Erro ao criar pagamento PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
    }

    const pixPaymentData = await asaasResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-pix-created',
      message: 'PIX payment created successfully with Asaas',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: pixPaymentData.id,
        status: pixPaymentData.status
      }
    });

    // Buscar QR Code do PIX
    const pixQrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${pixPaymentData.id}/pixQrCode`, {
      method: 'GET',
      headers: asaasHeaders
    });

    if (!pixQrCodeResponse.ok) {
      const errorData = await pixQrCodeResponse.json();
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-pix-qrcode-error',
        message: 'Failed to fetch PIX QR Code from Asaas',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id,
          asaasError: errorData,
          httpStatus: pixQrCodeResponse.status
        }
      });
      throw new Error('Erro ao gerar QR Code PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
    }

    const pixQrCodeData = await pixQrCodeResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-pix-qrcode-success',
      message: 'PIX QR Code fetched successfully',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: pixPaymentData.id,
        hasPayload: !!pixQrCodeData.payload,
        hasEncodedImage: !!pixQrCodeData.encodedImage
      }
    });

    // Atualizar pedido com ID do pagamento
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ asaas_payment_id: pixPaymentData.id })
      .eq('id', order.id);

    if (updateOrderError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment-order-update-error',
        message: 'Failed to update order with payment ID, but payment was created',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id,
          error: updateOrderError.message
        }
      });
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment-order-updated',
        message: 'Order updated successfully with payment ID',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id
        }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'CORRECTED Payment creation completed successfully - DUPLICATES PREVENTED',
      metadata: { 
        orderId: order.id,
        userId,
        asaasPaymentId: pixPaymentData.id,
        originalProductCount: productIds.length,
        uniqueProductCount: uniqueProductIds.length,
        duplicatesRemoved: productIds.length - uniqueProductIds.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      asaasPaymentId: pixPaymentData.id,
      message: 'Pagamento iniciado com sucesso! Use o QR Code para pagar.',
      pixDetails: {
        id: pixPaymentData.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-unhandled-error',
      message: `Unhandled error in payment creation: ${error.message}`,
      metadata: {
        error: error.message,
        errorStack: error.stack,
        requestBody: {
          ...req.body,
          // Remove sensitive data from logs
          password: 'REDACTED',
          creditCard: 'REDACTED'
        }
      }
    });

    return new Response(JSON.stringify({ 
      error: 'Erro no processamento do pagamento: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
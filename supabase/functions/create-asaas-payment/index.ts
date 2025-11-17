Código novo import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    // Normalizar email
    const normalizedEmail = email?.toLowerCase().trim();

    // LOG INICIAL
    await supabase.from('logs').insert({
      level: 'info',
      context: 'payment-start',
      message: 'Iniciando processamento de pagamento',
      metadata: { 
        timestamp: new Date().toISOString(),
        email: normalizedEmail,
        productCount: productIds?.length || 0,
        paymentMethod,
        hasCoupon: !!coupon_code
      }
    });

    // ==================== VALIDAÇÃO DE CAMPOS OBRIGATÓRIOS ====================
    const missingFields = [];
    if (!name?.trim()) missingFields.push('name');
    if (!email?.trim()) missingFields.push('email');
    if (!cpf?.trim()) missingFields.push('cpf');
    if (!whatsapp?.trim()) missingFields.push('whatsapp');
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) missingFields.push('productIds');
    if (!paymentMethod) missingFields.push('paymentMethod');

    if (missingFields.length > 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'validation-error',
        message: 'Campos obrigatórios ausentes',
        metadata: { missingFields }
      });
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // VALIDAÇÃO DE MÉTODO DE PAGAMENTO
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'validation-error',
        message: 'Método de pagamento inválido',
        metadata: { paymentMethod }
      });
      throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
    }

    // VALIDAÇÃO ESPECÍFICA PARA CARTÃO DE CRÉDITO
    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'validation-error',
        message: 'Dados do cartão de crédito ausentes',
        metadata: { paymentMethod }
      });
      throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
    }

    // ==================== REMOÇÃO DE DUPLICATAS DE PRODUTOS ====================
    const uniqueProductIds = [...new Set(productIds)];
    const duplicatesRemoved = productIds.length - uniqueProductIds.length;

    if (duplicatesRemoved > 0) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'duplicate-products-removed',
        message: 'Produtos duplicados foram removidos automaticamente',
        metadata: { 
          originalCount: productIds.length,
          uniqueCount: uniqueProductIds.length,
          duplicatesRemoved
        }
      });
    }

    // ==================== VALIDAÇÃO DE PRODUTOS ====================
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', uniqueProductIds);

    if (productsError || !products) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'product-validation-error',
        message: 'Erro ao buscar produtos',
        metadata: { 
          uniqueProductIds,
          error: productsError?.message
        }
      });
      throw new Error('Erro ao buscar produtos: ' + (productsError?.message || 'Erro desconhecido'));
    }

    // Verificar se todos os produtos foram encontrados
    if (products.length !== uniqueProductIds.length) {
      const foundIds = products.map(p => p.id);
      const missingIds = uniqueProductIds.filter(id => !foundIds.includes(id));
      
      await supabase.from('logs').insert({
        level: 'error',
        context: 'product-not-found',
        message: 'Alguns produtos não foram encontrados',
        metadata: { 
          requestedIds: uniqueProductIds,
          missingIds
        }
      });
      throw new Error(`Produtos não encontrados: ${missingIds.join(', ')}`);
    }

    // Verificar se todos os produtos estão ativos
    const inactiveProducts = products.filter(p => p.status !== 'ativo');
    if (inactiveProducts.length > 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'product-inactive',
        message: 'Alguns produtos não estão disponíveis',
        metadata: { 
          inactiveProducts: inactiveProducts.map(p => ({ id: p.id, name: p.name }))
        }
      });
      throw new Error(`Produtos não disponíveis: ${inactiveProducts.map(p => p.name).join(', ')}`);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'product-validation-success',
      message: 'Todos os produtos validados',
      metadata: { 
        validatedCount: products.length,
        productNames: products.map(p => p.name)
      }
    });

    // ==================== GERENCIAMENTO DE USUÁRIO (CORRIGIDO) ====================
    let userId: string;
    
    try {
      // Verificar se usuário existe no Auth
      const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
      
      if (listUsersError) {
        throw new Error('Erro ao verificar usuários existentes: ' + listUsersError.message);
      }

      const existingAuthUser = existingUsers.users?.find(u => u.email?.toLowerCase() === normalizedEmail);

      if (existingAuthUser) {
        // Usuário existe no Auth
        userId = existingAuthUser.id;
        
        await supabase.from('logs').insert({
          level: 'info',
          context: 'user-exists',
          message: 'Usuário existente encontrado',
          metadata: { 
            userId,
            email: normalizedEmail
          }
        });

        // USAR UPSERT PARA GARANTIR QUE O PERFIL EXISTA
        const { error: upsertProfileError } = await supabase
          .from('profiles')
          .upsert({ 
            id: userId,
            name: name.trim(),
            cpf: cpf.trim(),
            email: normalizedEmail,
            whatsapp: whatsapp.trim(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (upsertProfileError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'profile-upsert-error',
            message: 'Erro ao atualizar/criar perfil do usuário',
            metadata: { 
              userId,
              error: upsertProfileError.message,
              errorCode: upsertProfileError.code
            }
          });
          throw new Error('Erro ao atualizar perfil: ' + upsertProfileError.message);
        }

        await supabase.from('logs').insert({
          level: 'info',
          context: 'profile-updated',
          message: 'Perfil do usuário atualizado com sucesso',
          metadata: { userId }
        });

      } else {
        // Usuário NÃO existe - criar novo
        await supabase.from('logs').insert({
          level: 'info',
          context: 'creating-new-user',
          message: 'Criando novo usuário',
          metadata: { 
            email: normalizedEmail
          }
        });

        // Criar usuário no Auth
        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: normalizedEmail,
          password: cpf.trim(),
          email_confirm: true,
          user_metadata: { 
            name: name.trim(),
            cpf: cpf.trim(),
            whatsapp: whatsapp.trim(),
            created_via: 'checkout',
            created_at_checkout: new Date().toISOString()
          },
        });

        if (createUserError || !newUser?.user) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'auth-creation-error',
            message: 'Falha ao criar usuário no Auth',
            metadata: { 
              email: normalizedEmail,
              error: createUserError?.message,
              errorCode: createUserError?.code
            }
          });
          throw new Error('Erro ao criar usuário: ' + (createUserError?.message || 'Erro desconhecido'));
        }

        userId = newUser.user.id;

        await supabase.from('logs').insert({
          level: 'info',
          context: 'auth-created',
          message: 'Usuário Auth criado com sucesso',
          metadata: { 
            userId,
            email: normalizedEmail
          }
        });

        // Criar perfil (com UPSERT para segurança adicional)
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            id: userId,
            name: name.trim(),
            cpf: cpf.trim(),
            email: normalizedEmail,
            whatsapp: whatsapp.trim(),
            access: [], // Vazio - será preenchido pelo webhook
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: false
          });

        if (profileError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'profile-creation-error',
            message: 'Falha ao criar perfil do usuário',
            metadata: { 
              userId,
              error: profileError.message,
              errorCode: profileError.code
            }
          });
          
          // Rollback: deletar usuário Auth criado
          await supabase.auth.admin.deleteUser(userId);
          
          throw new Error('Erro ao criar perfil: ' + profileError.message);
        }

        await supabase.from('logs').insert({
          level: 'info',
          context: 'profile-created',
          message: 'Perfil do usuário criado com sucesso',
          metadata: { 
            userId,
            email: normalizedEmail
          }
        });
      }
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-error',
        message: 'Erro no gerenciamento de usuário',
        metadata: { 
          email: normalizedEmail,
          error: error.message,
          errorStack: error.stack
        }
      });
      throw new Error('Erro no gerenciamento de usuário: ' + error.message);
    }

    // ==================== CRIAÇÃO DO PEDIDO ====================
    const totalPrice = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'creating-order',
      message: 'Criando pedido',
      metadata: { 
        userId,
        productCount: uniqueProductIds.length,
        totalPrice
      }
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: uniqueProductIds,
        total_price: totalPrice,
        status: 'pending',
        meta_tracking_data: {
          ...metaTrackingData,
          client_ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
          client_user_agent: req.headers.get('user-agent') || '',
          duplicate_removal: {
            originalCount: productIds.length,
            uniqueCount: uniqueProductIds.length,
            duplicatesRemoved
          }
        }
      })
      .select()
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'order-creation-error',
        message: 'Falha ao criar pedido',
        metadata: { 
          userId,
          error: orderError?.message,
          errorCode: orderError?.code
        }
      });
      throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-created',
      message: 'Pedido criado com sucesso',
      metadata: { 
        orderId: order.id,
        userId,
        status: order.status
      }
    });

    // ==================== PROCESSAMENTO DO PAGAMENTO ====================
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'config-error',
        message: 'Credenciais Asaas não configuradas',
        metadata: { 
          hasApiKey: !!ASAAS_API_KEY,
          hasBaseUrl: !!ASAAS_BASE_URL
        }
      });
      throw new Error('Configuração de pagamento não encontrada');
    }

    // Preparar payload do pagamento
    const asaasPayload = {
      customer: {
        name: name.trim(),
        email: normalizedEmail,
        cpfCnpj: cpf.trim(),
        phone: whatsapp.trim(),
      },
      value: parseFloat(totalPrice.toFixed(2)),
      description: `Pedido #${order.id}`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // +1 dia
      billingType: paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD',
    };

    // Adicionar dados do cartão se for pagamento com cartão
    if (paymentMethod === 'CREDIT_CARD' && creditCard) {
      Object.assign(asaasPayload, {
        creditCard: {
          holderName: creditCard.holderName,
          number: creditCard.number,
          expiryMonth: creditCard.expiryMonth,
          expiryYear: creditCard.expiryYear,
          ccv: creditCard.ccv
        },
        creditCardHolderInfo: {
          name: name.trim(),
          email: normalizedEmail,
          cpfCnpj: cpf.trim(),
          postalCode: creditCard.postalCode,
          addressNumber: creditCard.addressNumber,
          phone: whatsapp.trim()
        }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'creating-payment',
      message: `Criando pagamento ${paymentMethod}`,
      metadata: { 
        orderId: order.id,
        paymentMethod,
        value: totalPrice
      }
    });

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // Criar pagamento no Asaas
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(asaasPayload)
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      await supabase.from('logs').insert({
        level: 'error',
        context: 'payment-creation-error',
        message: 'Falha ao criar pagamento no Asaas',
        metadata: { 
          orderId: order.id,
          asaasError: errorData,
          httpStatus: asaasResponse.status
        }
      });
      throw new Error('Erro ao criar pagamento: ' + (errorData.message || 'Erro na comunicação com gateway'));
    }

    const paymentData = await asaasResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'payment-created',
      message: 'Pagamento criado com sucesso no Asaas',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: paymentData.id,
        status: paymentData.status,
        paymentMethod
      }
    });

    // Se for PIX, buscar QR Code
    let pixDetails = null;
    if (paymentMethod === 'PIX') {
      const pixQrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
        method: 'GET',
        headers: asaasHeaders
      });

      if (!pixQrCodeResponse.ok) {
        const errorData = await pixQrCodeResponse.json();
        await supabase.from('logs').insert({
          level: 'error',
          context: 'pix-qrcode-error',
          message: 'Falha ao buscar QR Code PIX',
          metadata: { 
            orderId: order.id,
            asaasPaymentId: paymentData.id,
            asaasError: errorData
          }
        });
        throw new Error('Erro ao gerar QR Code PIX: ' + (errorData.message || 'Erro desconhecido'));
      }

      const pixQrCodeData = await pixQrCodeResponse.json();

      await supabase.from('logs').insert({
        level: 'info',
        context: 'pix-qrcode-success',
        message: 'QR Code PIX obtido com sucesso',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: paymentData.id
        }
      });

      pixDetails = {
        id: paymentData.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage,
        expirationDate: pixQrCodeData.expirationDate
      };
    }

    // Atualizar pedido com ID do pagamento
    const { error: updateOrderError } = await supabase
      .from('orders')
      .update({ 
        asaas_payment_id: paymentData.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);

    if (updateOrderError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'order-update-warning',
        message: 'Falha ao atualizar pedido com ID do pagamento (pagamento foi criado)',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: paymentData.id,
          error: updateOrderError.message
        }
      });
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'order-updated',
        message: 'Pedido atualizado com ID do pagamento',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: paymentData.id
        }
      });
    }

    // LOG FINAL DE SUCESSO
    await supabase.from('logs').insert({
      level: 'info',
      context: 'payment-success',
      message: 'Processo de pagamento concluído com sucesso',
      metadata: { 
        orderId: order.id,
        userId,
        asaasPaymentId: paymentData.id,
        paymentMethod,
        totalPrice,
        productCount: uniqueProductIds.length,
        duplicatesRemoved
      }
    });

    // Resposta de sucesso
    const response: any = {
      success: true,
      orderId: order.id,
      asaasPaymentId: paymentData.id,
      message: 'Pagamento processado com sucesso!',
      paymentMethod
    };

    if (pixDetails) {
      response.pixDetails = pixDetails;
    }

    if (duplicatesRemoved > 0) {
      response.warning = `${duplicatesRemoved} produto(s) duplicado(s) foram removidos automaticamente`;
    }

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log de erro final
    await supabase.from('logs').insert({
      level: 'error',
      context: 'payment-error',
      message: `Erro no processamento: ${error.message}`,
      metadata: {
        error: error.message,
        errorStack: error.stack
      }
    });

    return new Response(JSON.stringify({ 
      success: false,
      error: error.message || 'Erro no processamento do pagamento'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
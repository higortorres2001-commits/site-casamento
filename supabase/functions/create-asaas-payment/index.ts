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

    // LOG DETALHADO DO INÍCIO PARA DEBUG DA DUPLICAÇÃO
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-debug-start',
      message: '🔍 DEBUG: Iniciando processamento com análise detalhada de duplicação',
      metadata: { 
        timestamp: new Date().toISOString(),
        email: email?.toLowerCase().trim(),
        productIds: productIds,
        productCount: productIds?.length || 0,
        paymentMethod,
        hasCoupon: !!coupon_code,
        // Análise inicial de duplicatas
        duplicateAnalysis: {
          originalCount: productIds?.length || 0,
          uniqueCount: [...new Set(productIds || [])].length,
          hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length,
          duplicates: productIds ? productIds.filter((id, index) => productIds.indexOf(id) !== index) : []
        }
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
        message: '🔍 DEBUG: Campos obrigatórios ausentes',
        metadata: { 
          missingFields,
          receivedFields: Object.keys(req.body),
          productIds,
          duplicateAnalysis: {
            originalCount: productIds?.length || 0,
            uniqueCount: [...new Set(productIds || [])].length,
            hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length
          }
        }
      });
      throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
    }

    // VALIDAÇÃO DE MÉTODO DE PAGAMENTO
    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation-error',
        message: '🔍 DEBUG: Método de pagamento inválido',
        metadata: { 
          paymentMethod,
          validMethods: ['PIX', 'CREDIT_CARD'],
          productIds,
          duplicateAnalysis: {
            originalCount: productIds?.length || 0,
            uniqueCount: [...new Set(productIds || [])].length,
            hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length
          }
        }
      });
      throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
    }

    // VALIDAÇÃO ESPECÍFICA PARA CARTÃO DE CRÉDITO
    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-validation-error',
        message: '🔍 DEBUG: Dados do cartão de crédito ausentes',
        metadata: { 
          paymentMethod,
          hasCreditCard: !!creditCard,
          productIds,
          duplicateAnalysis: {
            originalCount: productIds?.length || 0,
            uniqueCount: [...new Set(productIds || [])].length,
            hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length
          }
        }
      });
      throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-validation-success',
      message: '🔍 DEBUG: Validação inicial concluída com sucesso',
      metadata: { 
        email: email?.toLowerCase().trim(),
        productCount: productIds?.length || 0,
        paymentMethod,
        hasCoupon: !!coupon_code,
        duplicateAnalysis: {
          originalCount: productIds?.length || 0,
          uniqueCount: [...new Set(productIds || [])].length,
          hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length,
          duplicates: productIds ? productIds.filter((id, index) => productIds.indexOf(id) !== index) : []
        }
      }
    });

    // ANÁLISE DETALHADA DA DUPLICAÇÃO ANTES DE CONTINUAR
    const duplicateAnalysis = {
      originalCount: productIds?.length || 0,
      uniqueCount: [...new Set(productIds || [])].length,
      hasDuplicates: (productIds?.length || 0) !== [...new Set(productIds || [])].length,
      duplicates: productIds ? productIds.filter((id, index) => productIds.indexOf(id) !== index) : [],
      duplicatesRemoved: 0
    };

    if (duplicateAnalysis.hasDuplicates) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-duplicate-error',
        message: '🔍 DEBUG: DUPLICAÇÃO DETECTADA - IDs duplicados no array do pedido',
        metadata: { 
          email: email?.toLowerCase().trim(),
          duplicateAnalysis,
          requestedProductIds: productIds,
          // Log completo dos IDs duplicados
          duplicateIds: duplicateAnalysis.duplicates,
          duplicateCount: duplicateAnalysis.duplicates.length,
          uniqueProductIds: [...new Set(productIds || [])],
          frontendIssue: 'Cliente está enviando IDs duplicados no array productIds'
        }
      });
      
      throw new Error(`🔍 DEBUG ERRO: IDs duplicados detectados no pedido. IDs duplicados: ${duplicateAnalysis.duplicates.join(', ')}. IDs únicos: ${[...new Set(productIds || [])].join(', ')}. O frontend precisa corrigir o array para não enviar duplicatas.`);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-duplicate-check-passed',
      message: '🔍 DEBUG: Verificação de duplicação passou - nenhum ID duplicado encontrado',
      metadata: { 
        email: email?.toLowerCase().trim(),
        duplicateAnalysis,
        uniqueProductIds: [...new Set(productIds || [])],
        productCount: productIds?.length || 0
      }
    });

    // CORREÇÃO: Usar Set para eliminar duplicatas e garantir IDs únicos
    const uniqueProductIds = [...new Set(productIds)];
    
    if (uniqueProductIds.length !== productIds.length) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment-duplicates-removed',
        message: '🔍 DEBUG: Duplicatas removidas pelo backend - usando Set para garantir IDs únicos',
        metadata: { 
          email: email?.toLowerCase().trim(),
          originalCount: productIds.length,
          uniqueCount: uniqueProductIds.length,
          duplicatesRemoved: productIds.length - uniqueProductIds.length,
          originalIds: productIds,
          uniqueIds: uniqueProductIds,
          frontendIssue: 'Frontend enviou duplicatas, mas backend corrigiu automaticamente'
        }
      });
    }

    // VALIDAÇÃO DE PRODUTOS (usando IDs únicos)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', uniqueProductIds);

    if (productsError || !products) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-product-validation-error',
        message: '🔍 DEBUG: Erro ao buscar produtos no banco',
        metadata: { 
          email: email?.toLowerCase().trim(),
          uniqueProductIds,
          error: productsError?.message,
          errorCode: productsError?.code,
          duplicateAnalysis
        }
      });
      throw new Error('Produtos não encontrados: ' + (productsError?.message || 'Erro desconhecido'));
    }

    if (products.length !== uniqueProductIds.length) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-product-missing-error',
        message: '🔍 DEBUG: Alguns produtos solicitados não foram encontrados',
        metadata: { 
          email: email?.toLowerCase().trim(),
          requestedIds: uniqueProductIds,
          foundIds: products.map(p => p.id),
          requestedCount: uniqueProductIds.length,
          foundCount: products.length,
          missingIds: uniqueProductIds.filter(id => !products.map(p => p.id).includes(id)),
          duplicateAnalysis
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
        message: '🔍 DEBUG: Alguns produtos solicitados não estão ativos',
        metadata: { 
          email: email?.toLowerCase().trim(),
          inactiveProducts: inactiveProducts.map(p => ({ id: p.id, name: p.name, status: p.status })),
          duplicateAnalysis
        }
      });
      throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-product-validation-success',
      message: '🔍 DEBUG: Todos os produtos validados com sucesso',
      metadata: { 
        email: email?.toLowerCase().trim(),
        validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price, status: p.status })),
        validatedCount: products.length,
        duplicateAnalysis
      }
    });

    // CRIAÇÃO DO USUÁRIO (mantendo lógica existente)
    let userId: string;
    
    try {
      const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (existingUser) {
        userId = existingUser.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-existing-user-found',
          message: '🔍 DEBUG: Usuário existente encontrado',
          metadata: { 
            userId,
            email: email?.toLowerCase().trim(),
            existingUserCreated: existingUser.created_at,
            duplicateAnalysis
          }
        });

        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ 
            name, 
            cpf: cpf, 
            email: email?.toLowerCase().trim(), 
            whatsapp: whatsapp,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingUser.id);

        if (updateProfileError) {
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'create-asaas-payment-profile-update-error',
            message: '🔍 DEBUG: Falha ao atualizar perfil do usuário existente',
            metadata: { 
              userId,
              error: updateProfileError.message,
              errorCode: updateProfileError.code,
              duplicateAnalysis
            }
          });
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'create-asaas-payment-profile-updated',
            message: '🔍 DEBUG: Perfil do usuário existente atualizado com sucesso',
            metadata: { 
              userId,
              duplicateAnalysis
            }
          });
        }
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-creating-new-user',
          message: '🔍 DEBUG: Criando novo usuário (Auth + Profile)',
          metadata: { 
            email: email?.toLowerCase().trim(),
            cpfLength: cpf.length,
            flow: 'checkout',
            duplicateAnalysis
          }
        });

        const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: email?.toLowerCase().trim(),
          password: cpf,
          email_confirm: true,
          user_metadata: { 
            name, 
            cpf: cpf, 
            whatsapp: whatsapp,
            created_via: 'checkout',
            created_at_checkout: new Date().toISOString()
          },
        });

        if (createUserError || !newUser?.user) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'create-asaas-payment-auth-creation-error',
            message: '🔍 DEBUG: FALHA CRÍTICA ao criar usuário Auth',
            metadata: { 
              email: email?.toLowerCase().trim(),
              error: createUserError?.message,
              errorType: createUserError?.name,
              errorCode: createUserError?.code,
              flow: 'checkout',
              duplicateAnalysis
            }
          });
          throw new Error('Erro ao criar conta de usuário: ' + (createUserError?.message || 'Erro desconhecido'));
        }

        userId = newUser.user.id;

        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-auth-created',
          message: '🔍 DEBUG: Usuário Auth criado com sucesso',
          metadata: { 
            userId,
            email: email?.toLowerCase().trim(),
            flow: 'checkout',
            duplicateAnalysis
          }
        });

        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            name: name,
            cpf: cpf,
            email: email?.toLowerCase().trim(),
            whatsapp: whatsapp,
            access: [], // ⚠️ VAZIO - acesso será liberado pelo webhook
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          });

        if (profileError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'create-asaas-payment-profile-creation-error',
            message: '🔍 DEBUG: FALHA CRÍTICA ao criar perfil do novo usuário',
            metadata: { 
              userId,
              email: email?.toLowerCase().trim(),
              error: profileError.message,
              errorCode: profileError.code,
              flow: 'checkout',
              duplicateAnalysis
            }
          });
          
          await supabase.auth.admin.deleteUser(userId);
          
          throw new Error('Erro ao criar perfil do usuário: ' + profileError.message);
        }

        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-asaas-payment-profile-created',
          message: '🔍 DEBUG: Perfil do novo usuário criado com sucesso',
          metadata: { 
            userId,
            email: email?.toLowerCase().trim(),
            flow: 'checkout',
            access: [], // Confirmado que está vazio
            duplicateAnalysis
          }
        });
      }
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-user-management-error',
        message: `🔍 DEBUG: Erro no gerenciamento de usuário: ${error.message}`,
        metadata: { 
          email: email?.toLowerCase().trim(),
          error: error.message,
          errorStack: error.stack,
          flow: 'checkout',
          duplicateAnalysis
        }
      });
      throw new Error('Erro no gerenciamento de usuário: ' + error.message);
    }

    // CRIAÇÃO DO PEDIDO (usando IDs únicos)
    const originalTotal = products.reduce((sum: number, product: any) => sum + parseFloat(product.price.toString()), 0);

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-order-creation',
      message: '🔍 DEBUG: Criando pedido com IDs únicos',
      metadata: { 
        userId,
        uniqueProductIds,
        originalTotal,
        productCount: uniqueProductIds.length,
        duplicateAnalysis
      }
    });

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: uniqueProductIds, // ✅ USANDO ARRAY COM IDs ÚNICOS
        total_price: originalTotal,
        status: 'pending',
        meta_tracking_data: {
          ...metaTrackingData,
          client_ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1',
          client_user_agent: req.headers.get('user-agent') || '',
          duplicateAnalysis: {
            originalCount: productIds.length,
            uniqueCount: uniqueProductIds.length,
            duplicatesRemoved: productIds.length - uniqueProductIds.length,
            originalIds: productIds,
            uniqueIds: uniqueProductIds
          }
        }
      })
      .select()
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-order-creation-error',
        message: '🔍 DEBUG: FALHA ao criar pedido no banco',
        metadata: { 
          userId,
          uniqueProductIds,
          originalTotal,
          error: orderError?.message,
          errorCode: orderError?.code,
          duplicateAnalysis
        }
      });
      throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-order-created',
      message: '🔍 DEBUG: Pedido criado com sucesso',
      metadata: { 
        orderId: order.id,
        userId,
        uniqueProductIds,
        originalTotal,
        status: order.status,
        duplicateAnalysis
      }
    });

    // PROCESSAMENTO DO PAGAMENTO
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-config-error',
        message: '🔍 DEBUG: Credenciais da API Asaas não configuradas',
        metadata: { 
          hasApiKey: !!ASAAS_API_KEY,
          hasBaseUrl: !!ASAAS_BASE_URL,
          duplicateAnalysis
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

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-pix-start',
      message: '🔍 DEBUG: Iniciando criação do pagamento PIX',
      metadata: { 
        orderId: order.id,
        userId,
        asaasPayload,
        duplicateAnalysis
      }
    });

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

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
        message: '🔍 DEBUG: Falha ao criar pagamento PIX com Asaas',
        metadata: { 
          orderId: order.id,
          asaasError: errorData,
          httpStatus: asaasResponse.status,
          httpStatusText: asaasResponse.statusText,
          duplicateAnalysis
        }
      });
      throw new Error('Erro ao criar pagamento PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
    }

    const pixPaymentData = await asaasResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-pix-created',
      message: '🔍 DEBUG: Pagamento PIX criado com sucesso',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: pixPaymentData.id,
        status: pixPaymentData.status,
        duplicateAnalysis
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
        message: '🔍 DEBUG: Falha ao buscar QR Code PIX',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id,
          asaasError: errorData,
          httpStatus: pixQrCodeResponse.status,
          httpStatusText: pixQrCodeResponse.statusText,
          duplicateAnalysis
        }
      });
      throw new Error('Erro ao gerar QR Code PIX: ' + (errorData.message || 'Erro na comunicação com gateway'));
    }

    const pixQrCodeData = await pixQrCodeResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-pix-qrcode-success',
      message: '🔍 DEBUG: QR Code PIX obtido com sucesso',
      metadata: { 
        orderId: order.id,
        asaasPaymentId: pixPaymentData.id,
        hasPayload: !!pixQrCodeData.payload,
        hasEncodedImage: !!pixQrCodeData.encodedImage,
        duplicateAnalysis
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
        message: '🔍 DEBUG: Falha ao atualizar pedido com ID do pagamento (mas pagamento foi criado)',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id,
          error: updateOrderError.message,
          duplicateAnalysis
        }
      });
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment-order-updated',
        message: '🔍 DEBUG: Pedido atualizado com ID do pagamento',
        metadata: { 
          orderId: order.id,
          asaasPaymentId: pixPaymentData.id,
          duplicateAnalysis
        }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: '🔍 DEBUG: Processo CORRETO concluído com sucesso - DUPLICAÇÃO PREVENIDA',
      metadata: { 
        orderId: order.id,
        userId,
        asaasPaymentId: pixPaymentData.id,
        originalProductCount: productIds.length,
        uniqueProductCount: uniqueProductIds.length,
        duplicatesRemoved: productIds.length - uniqueProductIds.length,
        duplicateAnalysis: {
          originalCount: productIds.length,
          uniqueCount: uniqueProductIds.length,
          hasDuplicates: false,
          duplicates: [],
          duplicatesRemoved: productIds.length - uniqueProductIds.length,
          originalIds: productIds,
          uniqueIds: uniqueProductIds
        }
      }
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      asaasPaymentId: pixPaymentData.id,
      message: '🔍 DEBUG: Pagamento iniciado com sucesso! Duplicação prevenida no backend.',
      pixDetails: {
        id: pixPaymentData.id,
        payload: pixQrCodeData.payload,
        encodedImage: pixQrCodeData.encodedImage
      },
      debugInfo: {
        duplicateAnalysis,
        originalProductIds: productIds,
        uniqueProductIds: uniqueProductIds,
        duplicatesRemoved: productIds.length - uniqueProductIds.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-unhandled-error',
      message: `🔍 DEBUG: Erro não tratado no processamento do pagamento: ${error.message}`,
      metadata: {
        error: error.message,
        errorStack: error.stack,
        requestBody: {
          ...req.body,
          password: 'REDACTED',
          creditCard: 'REDACTED'
        },
        duplicateAnalysis: {
          originalCount: req.body.productIds?.length || 0,
          uniqueCount: [...new Set(req.body.productIds || [])].length,
          hasDuplicates: (req.body.productIds?.length || 0) !== [...new Set(req.body.productIds || [])].length,
          duplicates: req.body.productIds ? req.body.productIds.filter((id, index) => req.body.productIds.indexOf(id) !== index) : []
        }
      }
    });

    return new Response(JSON.stringify({ 
      error: '🔍 DEBUG: Erro no processamento do pagamento: ' + error.message,
      debugInfo: {
        duplicateAnalysis: {
          originalCount: req.body.productIds?.length || 0,
          uniqueCount: [...new Set(req.body.productIds || [])].length,
          hasDuplicates: (req.body.productIds?.length || 0) !== [...new Set(req.body.productIds || [])].length,
          duplicates: req.body.productIds ? req.body.productIds.filter((id, index) => req.body.productIds.indexOf(id) !== index) : []
        }
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
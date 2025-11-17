import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ==================== CORRECTED USER SERVICE ====================
async function createUserCorrect(payload: any, supabase: any): Promise<string> {
  const email = payload.email.toLowerCase().trim();
  
  await supabase.from('logs').insert({
    level: 'info',
    context: 'corrected-user-creation-start',
    message: 'Starting CORRECTED user creation - Auth FIRST to satisfy foreign key',
    metadata: { 
      email,
      strategy: 'auth-first-corrected'
    }
  });

  // ETAPA 1: Verificar usuário existente por EMAIL
  try {
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingProfile) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'corrected-user-existing-found',
        message: 'Found existing user profile',
        metadata: { 
          userId: existingProfile.id,
          email
        }
      });
      return existingProfile.id;
    }
  } catch (error: any) {
    // Ignorar - continuar com criação
  }

  // ETAPA 2: Verificar se existe no Auth sem perfil
  try {
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const existingAuthUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);
    
    if (existingAuthUser) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'corrected-user-auth-without-profile',
        message: 'Found Auth user without profile - creating profile',
        metadata: { 
          userId: existingAuthUser.id,
          email
        }
      });

      // Criar perfil para usuário Auth existente
      try {
        await supabase
          .from('profiles')
          .insert({
            id: existingAuthUser.id,
            name: payload.name,
            cpf: payload.cpf,
            email: email,
            whatsapp: payload.whatsapp,
            access: [],
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          });

        return existingAuthUser.id;
      } catch (profileError: any) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'corrected-user-profile-creation-failed',
          message: 'Failed to create profile for existing Auth user - continuing with Auth ID',
          metadata: { 
            userId: existingAuthUser.id,
            error: profileError.message
          }
        });
        // Retornar o ID do Auth mesmo sem perfil - o pedido funcionará
        return existingAuthUser.id;
      }
    }
  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'corrected-user-auth-search-failed',
      message: 'Failed to search Auth users - will create new',
      metadata: { 
        email,
        error: error.message
      }
    });
  }

  // ETAPA 3: Criar NOVO usuário (Auth PRIMEIRO, depois Profile)
  let finalUserId: string | null = null;
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts && !finalUserId) {
    attempts++;
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'corrected-user-creation-attempt',
      message: `Creating new user (attempt ${attempts}/${maxAttempts}) - Auth FIRST`,
      metadata: { 
        email,
        attempt: attempts
      }
    });

    try {
      // PASSO 1: Criar usuário Auth PRIMEIRO (obrigatório para foreign key)
      const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
        email: email,
        password: payload.cpf,
        email_confirm: true,
        user_metadata: { 
          name: payload.name,
          cpf: payload.cpf,
          whatsapp: payload.whatsapp,
          created_via: 'corrected-checkout'
        },
      });

      if (authError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'corrected-user-auth-creation-failed',
          message: `Auth creation failed (attempt ${attempts}/${maxAttempts})`,
          metadata: { 
            email,
            error: authError.message,
            errorCode: authError.code,
            attempt: attempts
          }
        });

        // Se for erro de email duplicado, buscar o usuário existente
        if (authError.message?.includes('already registered') || authError.message?.includes('already exists')) {
          try {
            const { data: authUsers } = await supabase.auth.admin.listUsers();
            const existingUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);
            
            if (existingUser) {
              finalUserId = existingUser.id;
              await supabase.from('logs').insert({
                level: 'info',
                context: 'corrected-user-found-after-duplicate',
                message: 'Found existing Auth user after duplicate error',
                metadata: { 
                  userId: finalUserId,
                  email,
                  attempt: attempts
                }
              });
              break; // Usar o usuário existente
            }
          } catch (searchError: any) {
            // Ignorar erro de busca
          }
        }

        // Esperar antes da próxima tentativa
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000 * attempts));
        }
        continue;
      }

      if (!newAuthUser?.user) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'corrected-user-auth-no-user',
          message: `Auth creation returned no user (attempt ${attempts}/${maxAttempts})`,
          metadata: { 
            email,
            attempt: attempts
          }
        });
        continue;
      }

      finalUserId = newAuthUser.user.id;

      await supabase.from('logs').insert({
        level: 'info',
        context: 'corrected-user-auth-created',
        message: 'Auth user created successfully',
        metadata: { 
          userId: finalUserId,
          email,
          attempt: attempts
        }
      });

      // PASSO 2: Criar perfil (OPCIONAL - não falhar se der erro)
      try {
        await supabase
          .from('profiles')
          .insert({
            id: finalUserId,
            name: payload.name,
            cpf: payload.cpf,
            email: email,
            whatsapp: payload.whatsapp,
            access: [],
            primeiro_acesso: true,
            has_changed_password: false,
            is_admin: false,
            created_at: new Date().toISOString()
          });

        await supabase.from('logs').insert({
          level: 'info',
          context: 'corrected-user-profile-created',
          message: 'Profile created successfully for Auth user',
          metadata: { 
            userId: finalUserId,
            email,
            attempt: attempts
          }
        });
      } catch (profileError: any) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'corrected-user-profile-failed',
          message: 'Profile creation failed but Auth user exists - order will work',
          metadata: { 
            userId: finalUserId,
            email,
            error: profileError.message,
            errorCode: profileError.code,
            attempt: attempts
          }
        });
        // NÃO FALHAR - o usuário Auth existe, o pedido funcionará
      }

      break; // Sucesso - sair do loop

    } catch (exception: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'corrected-user-creation-exception',
        message: `Exception during user creation (attempt ${attempts}/${maxAttempts})`,
        metadata: { 
          email,
          error: exception.message,
          errorStack: exception.stack,
          attempt: attempts
        }
      });

      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 3000 * attempts));
      }
    }
  }

  // FALLBACK: Se tudo falhou, tentar buscar usuário existente uma última vez
  if (!finalUserId) {
    try {
      const { data: authUsers } = await supabase.auth.admin.listUsers();
      const existingUser = authUsers?.users?.find(u => u.email?.toLowerCase() === email);
      
      if (existingUser) {
        finalUserId = existingUser.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'corrected-user-fallback-found',
          message: 'Found existing user in fallback search',
          metadata: { 
            userId: finalUserId,
            email
          }
        });
      }
    } catch (fallbackError: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'corrected-user-fallback-failed',
        message: 'Fallback search also failed',
        metadata: { 
          email,
          error: fallbackError.message
        }
      });
    }
  }

  // ÚLTIMO RECURSO: Criar usuário com dados mínimos
  if (!finalUserId) {
    try {
      const { data: emergencyUser, error: emergencyError } = await supabase.auth.admin.createUser({
        email: `emergency-${Date.now()}@temp.com`, // Email temporário único
        password: payload.cpf,
        email_confirm: true,
        user_metadata: { 
          original_email: email,
          name: payload.name,
          cpf: payload.cpf,
          whatsapp: payload.whatsapp,
          created_via: 'emergency-fallback'
        },
      });

      if (!emergencyError && emergencyUser?.user) {
        finalUserId = emergencyUser.user.id;
        
        await supabase.from('logs').insert({
          level: 'error',
          context: 'corrected-user-emergency-created',
          message: 'EMERGENCY: Created user with temporary email to save sale',
          metadata: { 
            userId: finalUserId,
            originalEmail: email,
            emergencyEmail: `emergency-${Date.now()}@temp.com`,
            customerData: {
              name: payload.name,
              email: payload.email,
              cpf: payload.cpf,
              whatsapp: payload.whatsapp
            }
          }
        });
      }
    } catch (emergencyError: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'corrected-user-total-failure',
        message: 'TOTAL FAILURE: Cannot create any user - system issue',
        metadata: { 
          email,
          error: emergencyError.message,
          customerData: {
            name: payload.name,
            email: payload.email,
            cpf: payload.cpf,
            whatsapp: payload.whatsapp
          }
        }
      });
      throw new Error('Sistema temporariamente indisponível - dados salvos para contato manual');
    }
  }

  if (!finalUserId) {
    throw new Error('Falha total na criação de usuário - dados salvos para contato manual');
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'corrected-user-creation-complete',
    message: 'User creation completed - Auth user exists for foreign key',
    metadata: { 
      userId: finalUserId,
      email,
      totalAttempts: attempts
    }
  });

  return finalUserId;
}

// ==================== MAIN HANDLER ====================
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

  let customerData: any;

  try {
    const requestBody = await req.json();
    customerData = requestBody;
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'CORRECTED Payment creation started - Auth FIRST for foreign key',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code
      }
    });

    // VALIDAÇÕES BÁSICAS
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !paymentMethod) {
      throw new Error('Campos obrigatórios ausentes');
    }

    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      throw new Error('Método de pagamento inválido');
    }

    // VALIDAR PRODUTOS
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, price, name, status')
      .in('id', productIds);

    if (productsError || !products || products.length !== productIds.length) {
      throw new Error('Produtos não encontrados');
    }

    const inactiveProducts = products.filter(p => p.status !== 'ativo');
    if (inactiveProducts.length > 0) {
      throw new Error(`Produtos não disponíveis: ${inactiveProducts.map(p => p.name).join(', ')}`);
    }

    const originalTotal = products.reduce((sum: number, product: any) => sum + parseFloat(product.price), 0);

    // APLICAR CUPOM
    let finalTotal = originalTotal;
    let couponData = null;
    
    if (coupon_code) {
      try {
        const { data: coupon } = await supabase
          .from('coupons')
          .select('*')
          .eq('code', coupon_code.toUpperCase().trim())
          .eq('active', true)
          .single();

        if (coupon) {
          if (coupon.discount_type === 'percentage') {
            finalTotal = originalTotal * (1 - parseFloat(coupon.value) / 100);
          } else if (coupon.discount_type === 'fixed') {
            finalTotal = Math.max(0, originalTotal - parseFloat(coupon.value));
          }
          couponData = coupon;
        }
      } catch (e: any) {
        // Ignorar erro de cupom
      }
    }

    // CRIAR USUÁRIO (AUTH PRIMEIRO)
    const userId = await createUserCorrect({
      name,
      email: email.toLowerCase().trim(),
      cpf: cpf.replace(/[^0-9]/g, ''),
      whatsapp: whatsapp.replace(/\D/g, '')
    }, supabase);

    // CRIAR PEDIDO (agora com foreign key válida)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId, // Este ID agora EXISTE em auth.users
        ordered_product_ids: productIds,
        total_price: finalTotal,
        status: 'pending',
        meta_tracking_data: {
          ...metaTrackingData,
          client_ip_address: req.headers.get('x-forwarded-for') || '127.0.0.1',
          client_user_agent: req.headers.get('user-agent') || ''
        }
      })
      .select()
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'corrected-order-creation-failed',
        message: 'Order creation failed even with valid Auth user',
        metadata: { 
          userId,
          email,
          error: orderError?.message,
          errorCode: orderError?.code
        }
      });
      throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'corrected-order-created',
      message: 'Order created successfully with valid foreign key',
      metadata: { 
        orderId: order.id,
        userId,
        email,
        totalPrice: finalTotal
      }
    });

    // PROCESSAR PAGAMENTO
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      throw new Error('Configuração de pagamento não encontrada');
    }

    const asaasPayload: any = {
      customer: {
        name,
        email: email.toLowerCase().trim(),
        cpfCnpj: cpf.replace(/[^0-9]/g, ''),
        phone: whatsapp.replace(/\D/g, ''),
      },
      value: parseFloat(finalTotal.toFixed(2)),
      description: `Order #${order.id} payment`,
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      billingType: paymentMethod === 'PIX' ? 'PIX' : 'CREDIT_CARD',
    };

    if (paymentMethod === 'CREDIT_CARD' && creditCard) {
      asaasPayload.creditCard = {
        holderName: creditCard.holderName,
        number: creditCard.cardNumber.replace(/\s/g, ''),
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
      };
      asaasPayload.creditCardHolderInfo = {
        name,
        email: email.toLowerCase().trim(),
        cpfCnpj: cpf.replace(/[^0-9]/g, ''),
        phone: whatsapp.replace(/\D/g, ''),
        postalCode: creditCard.postalCode.replace(/\D/g, ''),
        addressNumber: creditCard.addressNumber,
      };
      asaasPayload.remoteIp = req.headers.get('x-forwarded-for') || '127.0.0.1';
      
      if (creditCard.installmentCount && creditCard.installmentCount > 1) {
        asaasPayload.installmentCount = creditCard.installmentCount;
        asaasPayload.installmentValue = parseFloat((finalTotal / creditCard.installmentCount).toFixed(2));
      }
    }

    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    // CRIAR PAGAMENTO
    const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(asaasPayload)
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      throw new Error('Erro ao criar pagamento: ' + (errorData.message || 'Erro na comunicação'));
    }

    const paymentData = await asaasResponse.json();

    // Atualizar pedido com ID do pagamento
    try {
      await supabase
        .from('orders')
        .update({ asaas_payment_id: paymentData.id })
        .eq('id', order.id);
    } catch (e: any) {
      // Ignorar erro de update
    }

    let result = { ...paymentData, orderId: order.id };

    // Se for PIX, buscar QR Code
    if (paymentMethod === 'PIX') {
      try {
        const pixQrCodeResponse = await fetch(`${ASAAS_BASE_URL}/payments/${paymentData.id}/pixQrCode`, {
          method: 'GET',
          headers: asaasHeaders
        });

        if (pixQrCodeResponse.ok) {
          const pixQrCodeData = await pixQrCodeResponse.json();
          result = {
            ...result,
            payload: pixQrCodeData.payload,
            encodedImage: pixQrCodeData.encodedImage,
          };
        }
      } catch (e: any) {
        // Ignorar erro de QR Code
      }
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'CORRECTED Payment completed successfully - FOREIGN KEY SATISFIED',
      metadata: { 
        orderId: order.id,
        userId,
        asaasPaymentId: paymentData.id,
        paymentMethod,
        finalTotal,
        originalTotal
      }
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // SALVAR DADOS PARA RECUPERAÇÃO
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-CRITICAL-FAILURE',
      message: `CRITICAL FAILURE: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack,
        CUSTOMER_CONTACT_DATA: {
          name: customerData?.name,
          email: customerData?.email,
          cpf: customerData?.cpf,
          whatsapp: customerData?.whatsapp,
          productIds: customerData?.productIds,
          coupon_code: customerData?.coupon_code
        },
        paymentMethod: customerData?.paymentMethod,
        timestamp: new Date().toISOString(),
        MANUAL_FOLLOW_UP_REQUIRED: true,
        PRIORITY: "URGENT"
      }
    });

    return new Response(JSON.stringify({ 
      error: 'Erro temporário. Seus dados foram salvos e entraremos em contato em até 1 hora.',
      details: 'Nossa equipe já foi notificada.',
      contact_saved: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
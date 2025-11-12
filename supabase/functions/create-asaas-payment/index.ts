import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Interfaces para tipagem
interface RequestPayload {
  name: string;
  email: string;
  cpf: string;
  whatsapp: string;
  productIds: string[];
  coupon_code?: string;
  paymentMethod: 'PIX' | 'CREDIT_CARD';
  creditCard?: any;
  metaTrackingData?: any;
}

interface UserData {
  id: string;
  isExisting: boolean;
}

interface ProductData {
  id: string;
  name: string;
  price: number;
  status: string;
}

interface OrderData {
  id: string;
  user_id: string;
  total_price: number;
  status: string;
}

interface CouponData {
  code: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
}

// Função para gerenciar usuário (existente ou novo) com tratamento de concorrência aprimorado
async function handleUserManagement(payload: RequestPayload, supabase: any): Promise<UserData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-start',
    message: 'Starting user management process',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      timestamp: new Date().toISOString()
    }
  });

  // ETAPA 1: Validação rigorosa dos dados de entrada
  if (!payload.email || !payload.cpf || !payload.name || !payload.whatsapp) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-validation',
      message: 'Missing required fields in payload',
      metadata: { 
        hasEmail: !!payload.email,
        hasCpf: !!payload.cpf,
        hasName: !!payload.name,
        hasWhatsapp: !!payload.whatsapp
      }
    });
    throw new Error('Dados obrigatórios ausentes: email, cpf, nome e whatsapp são necessários');
  }

  const cleanCpf = payload.cpf.replace(/[^\d]+/g, '');
  const cleanEmail = payload.email.toLowerCase().trim();

  if (cleanCpf.length !== 11) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-validation',
      message: 'Invalid CPF format',
      metadata: { 
        originalCpf: payload.cpf,
        cleanCpf,
        cleanCpfLength: cleanCpf.length
      }
    });
    throw new Error('CPF inválido: deve conter 11 dígitos');
  }

  // ETAPA 2: Verificação ATÔMICA de usuário existente por email E CPF
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-duplicate-check',
    message: 'Checking for existing user by email and CPF',
    metadata: { 
      email: cleanEmail,
      cpf: cleanCpf
    }
  });

  // Buscar usuário por EMAIL primeiro (mais comum)
  const { data: authUsersByEmail, error: listUsersByEmailError } = await supabase.auth.admin.listUsers();
  
  if (listUsersByEmailError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user by email',
      metadata: { 
        email: cleanEmail,
        error: listUsersByEmailError.message,
        errorType: listUsersByEmailError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente por email: ' + listUsersByEmailError.message);
  }

  const existingUserByEmail = authUsersByEmail.users.find(u => u.email?.toLowerCase() === cleanEmail);

  // Buscar perfil por CPF para verificar conflitos
  const { data: profileByCpf, error: profileByCpfError } = await supabase
    .from('profiles')
    .select('id, email, name, cpf')
    .eq('cpf', cleanCpf)
    .maybeSingle();

  if (profileByCpfError && profileByCpfError.code !== 'PGRST116') {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-check-error',
      message: 'Error checking CPF in profiles',
      metadata: { 
        cleanCpf,
        error: profileByCpfError.message,
        errorCode: profileByCpfError.code
      }
    });
    // Não falhar ainda - continuar com verificação por email
  }

  // CASO CRÍTICO 1: CPF já existe mas com email diferente
  if (profileByCpf && profileByCpf.email !== cleanEmail) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-email-mismatch',
      message: 'CPF conflict detected - same CPF with different email',
      metadata: { 
        requestedEmail: cleanEmail,
        existingEmail: profileByCpf.email,
        existingUserId: profileByCpf.id,
        cpf: cleanCpf
      }
    });
    throw new Error(`CPF já cadastrado com outro email: ${profileByCpf.email}. Não é possível criar conta com este CPF.`);
  }

  // CASO CRÍTICO 2: Email existe mas CPF não corresponde
  if (existingUserByEmail && profileByCpf && profileByCpf.id !== existingUserByEmail.id) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-id-mismatch',
      message: 'Critical ID mismatch between auth and profile',
      metadata: { 
        authUserId: existingUserByEmail.id,
        profileUserId: profileByCpf.id,
        email: cleanEmail,
        cpf: cleanCpf
      }
    });
    throw new Error('Conflito crítico: usuário existe no auth mas profile vinculado a outro ID. Contate o suporte.');
  }

  // USUÁRIO EXISTENTE: Email e CPF batem
  if (existingUserByEmail) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, updating profile',
      metadata: { 
        userId: existingUserByEmail.id,
        email: cleanEmail,
        existingUserCreated: existingUserByEmail.created_at,
        existingUserLastSignIn: existingUserByEmail.last_sign_in_at
      }
    });

    // ATUALIZAÇÃO SEGURA DO PERFIL - apenas se não existir ou se for o mesmo usuário
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, cpf, email')
      .eq('id', existingUserByEmail.id)
      .maybeSingle();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-check-error',
        message: 'Error checking existing profile, attempting upsert',
        metadata: { 
          userId: existingUserByEmail.id,
          error: profileCheckError.message,
          errorCode: profileCheckError.code
        }
      });
    }

    // Se o perfil não existe OU se existe e pertence ao mesmo usuário, fazer upsert
    if (!existingProfile || existingProfile.id === existingUserByEmail.id) {
      const { error: upsertProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: existingUserByEmail.id,
          name: payload.name, 
          cpf: cleanCpf, 
          email: cleanEmail, 
          whatsapp: payload.whatsapp.replace(/\D/g, ''),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (upsertProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-management-profile-upsert-error',
          message: 'CRITICAL: Failed to upsert user profile',
          metadata: { 
            userId: existingUserByEmail.id,
            error: upsertProfileError.message,
            errorCode: upsertProfileError.code,
            errorDetails: upsertProfileError.details
          }
        });
        throw new Error('Erro crítico ao atualizar perfil do usuário: ' + upsertProfileError.message);
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-upserted',
        message: 'Existing user profile upserted successfully',
        metadata: { userId: existingUserByEmail.id }
      });
    } else {
      // CASO CRÍTICO: Perfil existe mas com ID diferente - isso NÃO deveria acontecer
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-profile-id-mismatch',
        message: 'CRITICAL: Profile exists but with different ID than auth user',
        metadata: { 
          authUserId: existingUserByEmail.id,
          profileId: existingProfile.id,
          email: cleanEmail
        }
      });
      throw new Error('Conflito crítico de IDs entre auth e profile. Contate o suporte.');
    }

    return { id: existingUserByEmail.id, isExisting: true };
  }

  // NOVO USUÁRIO: Verificar se não há conflitos de CPF
  if (profileByCpf) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-conflict',
      message: 'CPF already registered but no matching auth user found',
      metadata: { 
        requestedEmail: cleanEmail,
        existingProfileEmail: profileByCpf.email,
        existingProfileId: profileByCpf.id,
        cpf: cleanCpf
      }
    });
    throw new Error(`CPF já cadastrado no sistema com o email: ${profileByCpf.email}. Não é possível criar nova conta.`);
  }

  // ETAPA 3: Criar novo usuário com validações adicionais
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-creating-new',
    message: 'Creating new user account with validations',
    metadata: { 
      email: cleanEmail,
      cpfLength: cleanCpf.length,
      timestamp: new Date().toISOString()
    }
  });

  let newUser;
  let createUserAttempts = 0;
  const maxAttempts = 3;

  while (createUserAttempts < maxAttempts) {
    try {
      // VERIFICAÇÃO FINAL ANTES DA CRIAÇÃO (double-check)
      const { data: finalAuthCheck } = await supabase.auth.admin.listUsers();
      const finalExistingUser = finalAuthCheck.users.find(u => u.email?.toLowerCase() === cleanEmail);
      
      if (finalExistingUser) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'user-management-race-condition',
          message: 'User created by another process during creation attempt',
          metadata: { 
            email: cleanEmail,
            existingUserId: finalExistingUser.id,
            attempt: createUserAttempts + 1
          }
        });
        return { id: finalExistingUser.id, isExisting: true };
      }

      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanCpf, // Senha inicial = CPF
        email_confirm: true,
        user_metadata: { 
          name: payload.name, 
          cpf: cleanCpf, 
          whatsapp: payload.whatsapp.replace(/\D/g, ''),
          created_via: 'checkout',
          created_at: new Date().toISOString()
        },
      });

      if (createUserError) {
        // Tratamento específico para conflitos
        if (createUserError.message.includes('duplicate') || 
            createUserError.message.includes('already registered') ||
            createUserError.message.includes('user_already_exists')) {
          
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'user-management-duplicate-detected',
            message: 'Duplicate user detected during creation, fetching existing user',
            metadata: { 
              email: cleanEmail,
              error: createUserError.message,
              attempt: createUserAttempts + 1
            }
          });

          // Buscar o usuário que foi criado
          const { data: retryUsers } = await supabase.auth.admin.listUsers();
          const retryUser = retryUsers.users.find(u => u.email?.toLowerCase() === cleanEmail);
          
          if (retryUser) {
            await supabase.from('logs').insert({
              level: 'info',
              context: 'user-management-retry-success',
              message: 'Found existing user after duplicate error',
              metadata: { 
                userId: retryUser.id,
                email: cleanEmail
              }
            });
            return { id: retryUser.id, isExisting: true };
          }
        }

        throw createUserError;
      }

      if (!createdUser?.user) {
        throw new Error('Erro desconhecido: usuário não criado');
      }

      newUser = createdUser.user;
      break; // Sucesso, sair do loop

    } catch (createError: any) {
      createUserAttempts++;
      
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-create-attempt',
        message: `User creation attempt ${createUserAttempts} failed`,
        metadata: { 
          email: cleanEmail,
          error: createError.message,
          attempt: createUserAttempts
        }
      });

      if (createUserAttempts >= maxAttempts) {
        throw new Error(`Falha ao criar usuário após ${maxAttempts} tentativas: ${createError.message}`);
      }

      // Esperar antes de tentar novamente (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, createUserAttempts)));
    }
  }

  if (!newUser) {
    throw new Error('Falha crítica: usuário não criado após todas as tentativas');
  }

  // ETAPA 4: Criar perfil com verificação final
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-profile-creation',
    message: 'Creating profile for new user with final validation',
    metadata: { userId: newUser.id }
  });

  // VERIFICAÇÃO FINAL: garantir que não há perfil com este ID ou CPF
  const { data: finalProfileCheck, error: finalProfileCheckError } = await supabase
    .from('profiles')
    .select('id, cpf')
    .or(`id.eq.${newUser.id},cpf.eq.${cleanCpf}`);

  if (finalProfileCheckError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-final-profile-check-error',
      message: 'Error in final profile validation',
      metadata: { 
        userId: newUser.id,
        error: finalProfileCheckError.message
      }
    });
    // Continuar mesmo com erro - tentar criar o perfil
  }

  if (finalProfileCheck && finalProfileCheck.length > 0) {
    const conflictingProfile = finalProfileCheck.find(p => p.id !== newUser.id);
    if (conflictingProfile) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-final-conflict',
        message: 'CRITICAL: Profile conflict detected after user creation',
        metadata: { 
          newUserId: newUser.id,
          conflictingProfileId: conflictingProfile.id,
          conflictingCpf: conflictingProfile.cpf
        }
      });
      throw new Error('Conflito crítico detectado após criação do usuário. Contate o suporte.');
    }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: newUser.id,
      name: payload.name,
      cpf: cleanCpf,
      email: cleanEmail,
      whatsapp: payload.whatsapp.replace(/\D/g, ''),
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
      context: 'user-management-profile-creation-error',
      message: 'CRITICAL: Failed to create profile for new user',
      metadata: { 
        userId: newUser.id,
        error: profileError.message,
        errorCode: profileError.code,
        errorDetails: profileError.details
      }
    });
    
    // Tentar deletar o usuário auth criado para evitar inconsistência
    try {
      await supabase.auth.admin.deleteUser(newUser.id);
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-cleanup',
        message: 'Deleted auth user due to profile creation failure',
        metadata: { userId: newUser.id }
      });
    } catch (deleteError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-cleanup-error',
        message: 'Failed to cleanup auth user after profile creation failure',
        metadata: { 
          userId: newUser.id,
          error: deleteError.message
        }
      });
    }
    
    throw new Error('Erro crítico ao criar perfil do usuário: ' + profileError.message);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-profile-created',
    message: 'Profile created successfully for new user',
    metadata: { userId: newUser.id }
  });

  return { id: newUser.id, isExisting: false };
}

// Função para validar dados de entrada
async function validateRequestData(requestBody: any, supabase: any): Promise<RequestPayload> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'create-payment-validation-start',
    message: 'Starting request validation',
    metadata: { 
      hasName: !!requestBody.name,
      hasEmail: !!requestBody.email,
      hasCpf: !!requestBody.cpf,
      hasWhatsapp: !!requestBody.whatsapp,
      hasProductIds: !!requestBody.productIds,
      productCount: requestBody.productIds?.length || 0,
      paymentMethod: requestBody.paymentMethod
    }
  });

  const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

  // Validação de campos obrigatórios
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
      context: 'create-payment-validation-error',
      message: 'Missing required fields in request',
      metadata: { missingFields, receivedFields: Object.keys(requestBody) }
    });
    throw new Error(`Campos obrigatórios ausentes: ${missingFields.join(', ')}`);
  }

  // Validação de método de pagamento
  if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-payment-validation-error',
      message: 'Invalid payment method',
      metadata: { paymentMethod, validMethods: ['PIX', 'CREDIT_CARD'] }
    });
    throw new Error(`Método de pagamento inválido: ${paymentMethod}`);
  }

  // Validação específica para cartão de crédito
  if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-payment-validation-error',
      message: 'Credit card data missing for CREDIT_CARD payment',
      metadata: { paymentMethod, hasCreditCard: !!creditCard }
    });
    throw new Error('Dados do cartão de crédito são obrigatórios para pagamento com cartão');
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'create-payment-validation-success',
    message: 'Request validation completed successfully',
    metadata: { 
      email: email.toLowerCase().trim(),
      paymentMethod,
      productCount: productIds.length,
      hasCoupon: !!coupon_code
    }
  });

  return {
    name,
    email: email.toLowerCase().trim(),
    cpf: cpf.replace(/[^0-9]/g, ''),
    whatsapp: whatsapp.replace(/\D/g, ''),
    productIds,
    coupon_code,
    paymentMethod,
    creditCard,
    metaTrackingData
  };
}

// Função para validar produtos
async function validateProducts(productIds: string[], supabase: any): Promise<ProductData[]> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'product-validation-start',
    message: 'Starting product validation',
    metadata: { 
      requestedProductIds: productIds,
      productCount: productIds.length
    }
  });

  const uniqueProductIds = [...new Set(productIds)];

  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('id, price, name, status')
    .in('id', uniqueProductIds);

  if (productsError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-query-error',
      message: 'Database error while fetching products',
      metadata: { 
        requestedIds: uniqueProductIds,
        error: productsError.message,
        errorCode: productsError.code
      }
    });
    throw new Error('Erro ao buscar produtos no banco de dados: ' + productsError.message);
  }

  if (!products || products.length !== uniqueProductIds.length) {
    const foundIds = new Set(products?.map(p => p.id) || []);
    const missingIds = uniqueProductIds.filter(id => !foundIds.has(id));

    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-missing-products',
      message: 'Some requested products were not found',
      metadata: { 
        requestedIds: uniqueProductIds,
        foundIds: Array.from(foundIds),
        missingIds,
        foundCount: products?.length || 0,
        requestedCount: uniqueProductIds.length
      }
    });
    throw new Error(`Produtos não encontrados: ${missingIds.join(', ')}`);
  }

  // Verificar se todos os produtos estão ativos
  const inactiveProducts = products.filter(p => p.status !== 'ativo');
  if (inactiveProducts.length > 0) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'product-validation-inactive-products',
      message: 'Some requested products are not active',
      metadata: { 
        inactiveProducts: inactiveProducts.map(p => ({ id: p.id, name: p.name, status: p.status }))
      }
    });
    throw new Error(`Produtos não disponíveis para compra: ${inactiveProducts.map(p => p.name).join(', ')}`);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'product-validation-success',
    message: 'All products validated successfully',
    metadata: { 
      validatedProducts: products.map(p => ({ id: p.id, name: p.name, price: p.price, status: p.status }))
    }
  });

  return products as ProductData[];
}

// Função para aplicar cupom de desconto
async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any): Promise<{ finalTotal: number; couponData?: CouponData }> {
  if (!couponCode) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'coupon-application-skipped',
      message: 'No coupon code provided, skipping coupon validation',
      metadata: { originalTotal }
    });
    return { finalTotal: originalTotal };
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'coupon-application-start',
    message: 'Starting coupon validation and application',
    metadata: { 
      couponCode: couponCode.toUpperCase().trim(),
      originalTotal
    }
  });

  const { data: coupon, error: couponError } = await supabase
    .from('coupons')
    .select('code, discount_type, value, active')
    .eq('code', couponCode.toUpperCase().trim())
    .eq('active', true)
    .single();

  if (couponError || !coupon) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'coupon-application-invalid',
      message: 'Invalid or inactive coupon code provided',
      metadata: { 
        couponCode: couponCode.toUpperCase().trim(),
        error: couponError?.message,
        errorCode: couponError?.code
      }
    });
    throw new Error(`Cupom inválido ou inativo: ${couponCode}`);
  }

  let finalTotal = originalTotal;
  let discountAmount = 0;

  if (coupon.discount_type === 'percentage') {
    discountAmount = originalTotal * (parseFloat(coupon.value) / 100);
    finalTotal = originalTotal - discountAmount;
  } else if (coupon.discount_type === 'fixed') {
    discountAmount = parseFloat(coupon.value);
    finalTotal = Math.max(0, originalTotal - discountAmount);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'coupon-application-success',
    message: 'Coupon applied successfully',
    metadata: { 
      couponCode: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.value,
      originalTotal,
      discountAmount,
      finalTotal
    }
  });

  return { finalTotal, couponData: coupon as CouponData };
}

// Função para criar pedido
async function createOrder(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any): Promise<OrderData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'order-creation-start',
    message: 'Starting order creation',
    metadata: { 
      userId,
      productIds,
      totalPrice,
      productCount: productIds.length
    }
  });

  const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
  const clientUserAgent = req.headers.get('user-agent') || '';

  const fullMetaTrackingData = {
    ...metaTrackingData,
    client_ip_address: clientIpAddress,
    client_user_agent: clientUserAgent,
  };

  const { data: order, error: orderError } = await supabase
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

  if (orderError || !order) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'order-creation-error',
      message: 'Failed to create order in database',
      metadata: { 
        userId,
        productIds,
        totalPrice,
        error: orderError?.message,
        errorCode: orderError?.code
      }
    });
    throw new Error('Erro ao criar pedido: ' + (orderError?.message || 'Erro desconhecido'));
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'order-creation-success',
    message: 'Order created successfully',
    metadata: { 
      orderId: order.id,
      userId,
      totalPrice,
      status: order.status
    }
  });

  return order as OrderData;
}

// Função auxiliar para atualizar pedido com ID do pagamento
async function updateOrderWithPaymentId(orderId: string, asaasPaymentId: string, supabase: any): Promise<void> {
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ asaas_payment_id: asaasPaymentId })
    .eq('id', orderId);

  if (orderUpdateError) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'order-payment-id-update-error',
      message: 'Failed to update order with payment ID, but payment was created',
      metadata: { 
        orderId,
        asaasPaymentId,
        error: orderUpdateError.message,
        errorCode: orderUpdateError.code
      }
    });
  } else {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'order-payment-id-updated',
      message: 'Order updated successfully with payment ID',
      metadata: { orderId, asaasPaymentId }
    });
  }
}

// Função para processar pagamento PIX
async function processPixPayment(order: OrderData, customerData: RequestPayload, supabase: any): Promise<any> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'pix-payment-start',
    message: 'Starting PIX payment processing with Asaas',
    metadata: { 
      orderId: order.id,
      totalPrice: order.total_price
    }
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'pix-payment-config-error',
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
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
    },
    value: parseFloat(order.total_price.toFixed(2)),
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
      context: 'pix-payment-creation-error',
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
    context: 'pix-payment-created',
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
      context: 'pix-qrcode-fetch-error',
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
    context: 'pix-qrcode-success',
    message: 'PIX QR Code fetched successfully',
    metadata: { 
      orderId: order.id,
      asaasPaymentId: pixPaymentData.id,
      hasPayload: !!pixQrCodeData.payload,
      hasEncodedImage: !!pixQrCodeData.encodedImage
    }
  });

  // Atualizar pedido com ID do pagamento
  await updateOrderWithPaymentId(order.id, pixPaymentData.id, supabase);

  return {
    id: pixPaymentData.id,
    orderId: order.id,
    payload: pixQrCodeData.payload,
    encodedImage: pixQrCodeData.encodedImage,
  };
}

// Função para processar pagamento com cartão de crédito
async function processCreditCardPayment(order: OrderData, customerData: RequestPayload, creditCardData: any, clientIpAddress: string, supabase: any): Promise<any> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'credit-card-payment-start',
    message: 'Starting credit card payment processing with Asaas',
    metadata: { 
      orderId: order.id,
      totalPrice: order.total_price,
      installmentCount: creditCardData.installmentCount || 1
    }
  });

  const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
  const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

  if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'credit-card-payment-config-error',
      message: 'Asaas API credentials not configured',
      metadata: { 
        hasApiKey: !!ASAAS_API_KEY,
        hasBaseUrl: !!ASAAS_BASE_URL
      }
    });
    throw new Error('Configuração de pagamento não encontrada');
  }

  const asaasPayload: any = {
    customer: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
    },
    value: parseFloat(order.total_price.toFixed(2)),
    description: `Order #${order.id} payment`,
    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    billingType: 'CREDIT_CARD',
    creditCard: {
      holderName: creditCardData.holderName,
      number: creditCardData.cardNumber.replace(/\s/g, ''),
      expiryMonth: creditCardData.expiryMonth,
      expiryYear: creditCardData.expiryYear,
      ccv: creditCardData.ccv,
    },
    creditCardHolderInfo: {
      name: customerData.name,
      email: customerData.email,
      cpfCnpj: customerData.cpf,
      phone: customerData.whatsapp,
      postalCode: creditCardData.postalCode.replace(/\D/g, ''),
      addressNumber: creditCardData.addressNumber,
    },
    remoteIp: clientIpAddress,
  };

  // Adicionar parcelas se especificado
  if (creditCardData.installmentCount && creditCardData.installmentCount > 1) {
    asaasPayload.installmentCount = creditCardData.installmentCount;
    asaasPayload.installmentValue = parseFloat((order.total_price / creditCardData.installmentCount).toFixed(2));
  }

  const asaasHeaders = {
    'Content-Type': 'application/json',
    'access_token': ASAAS_API_KEY,
  };

  const asaasResponse = await fetch(`${ASAAS_BASE_URL}/payments`, {
    method: 'POST',
    headers: asaasHeaders,
    body: JSON.stringify(asaasPayload),
  });

  if (!asaasResponse.ok) {
    const errorData = await asaasResponse.json();
    await supabase.from('logs').insert({
      level: 'error',
      context: 'credit-card-payment-creation-error',
      message: 'Failed to create credit card payment with Asaas',
      metadata: { 
        orderId: order.id,
        asaasError: errorData,
        httpStatus: asaasResponse.status,
        installmentCount: creditCardData.installmentCount || 1
      }
    });
    throw new Error('Erro ao processar pagamento com cartão: ' + (errorData.message || 'Erro na comunicação com gateway'));
  }

  const paymentData = await asaasResponse.json();

  await supabase.from('logs').insert({
    level: 'info',
    context: 'credit-card-payment-success',
    message: 'Credit card payment processed successfully',
    metadata: { 
      orderId: order.id,
      asaasPaymentId: paymentData.id,
      status: paymentData.status,
      authorizationCode: paymentData.authorizationCode
    }
  });

  // Atualizar pedido com ID do pagamento
  await updateOrderWithPaymentId(order.id, paymentData.id, supabase);

  return { ...paymentData, orderId: order.id };
}

// Função auxiliar para determinar em qual etapa o erro ocorreu
function getErrorStage(errorMessage: string): string {
  if (errorMessage.includes('Dados obrigatórios') || errorMessage.includes('CPF inválido')) {
    return 'validation';
  } else if (errorMessage.includes('CPF já cadastrado') || errorMessage.includes('Conflito crítico')) {
    return 'user_management';
  } else if (errorMessage.includes('perfil do usuário não foi criado')) {
    return 'profile_verification';
  } else if (errorMessage.includes('não estão mais disponíveis')) {
    return 'product_validation';
  } else if (errorMessage.includes('Método de pagamento não suportado')) {
    return 'payment_method';
  } else if (errorMessage.includes('pagamento')) {
    return 'payment_processing';
  } else {
    return 'unknown';
  }
}

// Função principal - Orquestrador limpo com validações adicionais
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let requestBody: any;
  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'Payment creation process started with enhanced validations',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        hasProductIds: !!requestBody.productIds,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code,
        userAgent: req.headers.get('user-agent')?.substring(0, 100) || 'unknown',
        clientIp: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1'
      }
    });

    // ETAPA 1: Validar dados de entrada com verificações adicionais
    const validatedPayload = await validateRequestData(requestBody, supabase);

    // VALIDAÇÃO ADICIONAL: Verificar se os produtos ainda estão disponíveis
    const products = await validateProducts(validatedPayload.productIds, supabase);
    
    // Verificação extra de concorrência - garantir que produtos ainda estão ativos
    const { data: realTimeProducts, error: realTimeCheckError } = await supabase
      .from('products')
      .select('id, status')
      .in('id', validatedPayload.productIds)
      .eq('status', 'ativo');

    if (realTimeCheckError || !realTimeProducts || realTimeProducts.length !== validatedPayload.productIds.length) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-realtime-validation',
        message: 'Products became unavailable during processing',
        metadata: { 
          requestedIds: validatedPayload.productIds,
          availableIds: realTimeProducts?.map(p => p.id) || [],
          error: realTimeCheckError?.message
        }
      });
      throw new Error('Um ou mais produtos não estão mais disponíveis. Atualize a página e tente novamente.');
    }

    // ETAPA 2: Gerenciar usuário com validações de concorrência
    const userData = await handleUserManagement(validatedPayload, supabase);
    userId = userData.id;

    // VERIFICAÇÃO CRÍTICA: Confirmar que o perfil foi criado corretamente
    const { data: profileVerification, error: profileVerificationError } = await supabase
      .from('profiles')
      .select('id, email, cpf')
      .eq('id', userId)
      .single();

    if (profileVerificationError || !profileVerification) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-profile-verification',
        message: 'CRITICAL: Profile verification failed after user management',
        metadata: { 
          userId,
          error: profileVerificationError?.message,
          profileExists: !!profileVerification
        }
      });
      throw new Error('Erro crítico: perfil do usuário não foi criado corretamente. Tente novamente.');
    }

    // Verificar consistência entre auth e profile
    if (profileVerification.email !== validatedPayload.email.toLowerCase().trim() || 
        profileVerification.cpf !== validatedPayload.cpf.replace(/[^\d]+/g, '')) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-data-mismatch',
        message: 'CRITICAL: Data mismatch between auth and profile',
        metadata: { 
          userId,
          authEmail: validatedPayload.email.toLowerCase().trim(),
          profileEmail: profileVerification.email,
          authCpf: validatedPayload.cpf.replace(/[^\d]+/g, ''),
          profileCpf: profileVerification.cpf
        }
      });
      throw new Error('Inconsistência crítica nos dados do usuário. Contate o suporte.');
    }

    // ETAPA 3: Calcular total e aplicar cupom
    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);
    const { finalTotal, couponData } = await applyCoupon(validatedPayload.coupon_code, originalTotal, supabase);

    // ETAPA 4: Criar pedido com verificação de duplicidade
    const existingOrderCheck = await supabase
      .from('orders')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .overlaps('ordered_product_ids', validatedPayload.productIds)
      .maybeSingle();

    if (existingOrderCheck?.data?.[0]) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-asaas-payment-duplicate-order',
        message: 'Duplicate pending order detected for same products',
        metadata: { 
          userId,
          existingOrderId: existingOrderCheck.data[0].id,
          productIds: validatedPayload.productIds
        }
      });
      // Não falhar - continuar com a criação do novo pedido
    }

    const order = await createOrder(userId, validatedPayload.productIds, finalTotal, validatedPayload.metaTrackingData, req, supabase);
    orderId = order.id;

    // ETAPA 5: Processar pagamento
    let paymentResult: any;
    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    if (validatedPayload.paymentMethod === 'PIX') {
      paymentResult = await processPixPayment(order, validatedPayload, supabase);
      asaasPaymentId = paymentResult.id;
    } else if (validatedPayload.paymentMethod === 'CREDIT_CARD') {
      paymentResult = await processCreditCardPayment(order, validatedPayload, validatedPayload.creditCard, clientIpAddress, supabase);
      asaasPaymentId = paymentResult.id;
    } else {
      throw new Error('Método de pagamento não suportado');
    }

    // ETAPA 6: Verificação final - garantir que tudo foi criado corretamente
    const finalOrderCheck = await supabase
      .from('orders')
      .select('id, asaas_payment_id, status')
      .eq('id', orderId)
      .single();

    if (!finalOrderCheck.data || finalOrderCheck.error) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-final-order-check',
        message: 'Order not found after creation',
        metadata: { 
          orderId,
          error: finalOrderCheck.error?.message
        }
      });
      // Não falhar o processo completo, mas logar o problema
    }

    // Log de sucesso detalhado
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'Payment creation process completed successfully with all validations',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        paymentMethod: validatedPayload.paymentMethod,
        finalTotal,
        originalTotal,
        discountApplied: originalTotal - finalTotal,
        wasExistingUser: userData.isExisting,
        productCount: validatedPayload.productIds.length,
        couponUsed: couponData?.code || null,
        profileVerified: true,
        dataConsistency: true
      }
    });

    return new Response(JSON.stringify({
      ...paymentResult,
      userCreated: !userData.isExisting,
      profileVerified: true
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-unhandled-error',
      message: `Payment creation failed: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        paymentMethod: requestBody?.paymentMethod,
        requestBodyKeys: requestBody ? Object.keys(requestBody) : [],
        stage: getErrorStage(error.message)
      }
    });

    // Limpeza em caso de erro: se o usuário foi criado mas o processo falhou
    if (userId && (!orderId || !asaasPaymentId)) {
      try {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'create-asaas-payment-cleanup',
          message: 'Attempting cleanup due to partial failure',
          metadata: { userId, orderId, asaasPaymentId }
        });

        // Se o pedido foi criado mas o pagamento falhou, marcar como falha
        if (orderId) {
          await supabase
            .from('orders')
            .update({ status: 'failed', meta_tracking_data: { ...requestBody?.metaTrackingData, error: error.message } })
            .eq('id', orderId);
        }

      } catch (cleanupError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment-cleanup-error',
          message: 'Cleanup failed',
          metadata: { 
            userId, 
            orderId, 
            cleanupError: cleanupError.message 
          }
        });
      }
    }

    // Retornar erro mais amigável para o usuário
    let userFriendlyMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.';
    
    if (error.message.includes('Dados obrigatórios')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('CPF inválido')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('CPF já cadastrado')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('Conflito crítico')) {
      userFriendlyMessage = 'Erro de conflito de dados. Entre em contato com o suporte.';
    } else if (error.message.includes('perfil do usuário não foi criado')) {
      userFriendlyMessage = 'Erro ao criar sua conta. Tente novamente ou entre em contato com o suporte.';
    } else if (error.message.includes('não estão mais disponíveis')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('Método de pagamento não suportado')) {
      userFriendlyMessage = 'Método de pagamento não suportado.';
    } else if (error.message.includes('Erro ao criar pagamento') || error.message.includes('Erro ao processar pagamento')) {
      userFriendlyMessage = 'Erro no processamento do pagamento. Verifique os dados e tente novamente.';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
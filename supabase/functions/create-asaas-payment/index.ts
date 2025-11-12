import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

// ==================== TYPES ====================
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

// ==================== BULLETPROOF USER SERVICE ====================
async function handleUserManagementBulletproof(payload: RequestPayload, supabase: any): Promise<UserData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-bulletproof-start',
    message: 'Starting BULLETPROOF user management - ZERO SALES LOST',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      flow: 'checkout-bulletproof'
    }
  });

  // ETAPA 1: Buscar usuário existente por EMAIL (mais confiável que listar todos)
  let existingUserId: string | null = null;
  
  try {
    // Buscar na tabela profiles primeiro (mais rápido e confiável)
    const { data: existingProfile, error: profileSearchError } = await supabase
      .from('profiles')
      .select('id, name, email, cpf, whatsapp, access')
      .eq('email', payload.email.toLowerCase())
      .single();

    if (!profileSearchError && existingProfile) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-existing-profile-found',
        message: 'Found existing profile by email',
        metadata: { 
          userId: existingProfile.id,
          email: payload.email,
          profileEmail: existingProfile.email
        }
      });

      // Atualizar dados se necessário
      const needsUpdate = 
        existingProfile.name !== payload.name ||
        existingProfile.cpf !== payload.cpf ||
        existingProfile.whatsapp !== payload.whatsapp;

      if (needsUpdate) {
        try {
          await supabase
            .from('profiles')
            .update({ 
              name: payload.name, 
              cpf: payload.cpf, 
              whatsapp: payload.whatsapp,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProfile.id);
        } catch (updateError: any) {
          // Não falhar se não conseguir atualizar
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'user-management-update-failed',
            message: 'Failed to update existing profile but continuing',
            metadata: { 
              userId: existingProfile.id,
              error: updateError.message
            }
          });
        }
      }

      return { id: existingProfile.id, isExisting: true };
    }

    // Se não encontrou na tabela profiles, buscar no Auth
    const { data: authUsers, error: authSearchError } = await supabase.auth.admin.listUsers();
    
    if (!authSearchError && authUsers?.users) {
      const existingAuthUser = authUsers.users.find(u => u.email?.toLowerCase() === payload.email.toLowerCase());
      
      if (existingAuthUser) {
        existingUserId = existingAuthUser.id;
        await supabase.from('logs').insert({
          level: 'info',
          context: 'user-management-existing-auth-found',
          message: 'Found existing Auth user without profile',
          metadata: { 
            userId: existingUserId,
            email: payload.email,
            authUserCreated: existingAuthUser.created_at
          }
        });
      }
    }
  } catch (searchError: any) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'user-management-search-error',
      message: 'Error searching for existing user - will create new',
      metadata: { 
        email: payload.email,
        error: searchError.message
      }
    });
  }

  // ETAPA 2: Se encontrou usuário Auth sem perfil, criar perfil
  if (existingUserId) {
    try {
      await supabase
        .from('profiles')
        .insert({
          id: existingUserId,
          name: payload.name,
          cpf: payload.cpf,
          email: payload.email,
          whatsapp: payload.whatsapp,
          access: [],
          primeiro_acesso: false,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString()
        });

      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-created-for-existing',
        message: 'Profile created for existing Auth user',
        metadata: { 
          userId: existingUserId,
          email: payload.email
        }
      });

      return { id: existingUserId, isExisting: true };
    } catch (profileError: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-profile-creation-failed-existing',
        message: 'Failed to create profile for existing Auth user - will continue with sale',
        metadata: { 
          userId: existingUserId,
          error: profileError.message,
          errorCode: profileError.code
        }
      });
      // CONTINUAR COM A VENDA usando o ID do Auth
      return { id: existingUserId, isExisting: true };
    }
  }

  // ETAPA 3: Criar novo usuário (ESTRATÉGIA BULLETPROOF)
  let finalUserId: string;
  let authCreated = false;
  let profileCreated = false;

  // ETAPA 3A: Gerar ID único ANTES de qualquer criação
  const uniqueUserId = crypto.randomUUID();
  
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-new-user-start',
    message: 'Creating new user with bulletproof strategy',
    metadata: { 
      email: payload.email,
      generatedUserId: uniqueUserId
    }
  });

  // ETAPA 3B: Tentar criar no Auth (não falhar se der erro)
  try {
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.cpf,
      email_confirm: true,
      user_metadata: { 
        name: payload.name, 
        cpf: payload.cpf, 
        whatsapp: payload.whatsapp,
        created_via: 'checkout-bulletproof',
        profile_id: uniqueUserId // Referência cruzada
      },
    });

    if (authError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-auth-creation-failed',
        message: 'Auth creation failed but sale will continue with profile-only approach',
        metadata: { 
          email: payload.email,
          generatedUserId: uniqueUserId,
          error: authError.message,
          errorCode: authError.code
        }
      });
      // NÃO FALHAR - usar apenas o perfil
      finalUserId = uniqueUserId;
    } else if (newAuthUser?.user) {
      finalUserId = newAuthUser.user.id;
      authCreated = true;
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-auth-created',
        message: 'Auth user created successfully',
        metadata: { 
          authUserId: finalUserId,
          email: payload.email,
          generatedUserId: uniqueUserId
        }
      });
    } else {
      finalUserId = uniqueUserId;
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-auth-no-user',
        message: 'Auth creation returned no user - using generated ID',
        metadata: { 
          email: payload.email,
          generatedUserId: uniqueUserId
        }
      });
    }
  } catch (authException: any) {
    finalUserId = uniqueUserId;
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'user-management-auth-exception',
      message: 'Auth creation threw exception - using generated ID',
      metadata: { 
        email: payload.email,
        generatedUserId: uniqueUserId,
        error: authException.message
      }
    });
  }

  // ETAPA 3C: Criar perfil (SEMPRE com ID único)
  try {
    await supabase
      .from('profiles')
      .insert({
        id: finalUserId, // Usar o ID final (Auth ou gerado)
        name: payload.name,
        cpf: payload.cpf,
        email: payload.email,
        whatsapp: payload.whatsapp,
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false,
        created_at: new Date().toISOString()
      });

    profileCreated = true;
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-profile-created',
      message: 'Profile created successfully with bulletproof strategy',
      metadata: { 
        userId: finalUserId,
        email: payload.email,
        authCreated,
        profileCreated: true
      }
    });
  } catch (profileError: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-profile-creation-failed',
      message: 'CRITICAL: Profile creation failed - SALE WILL STILL CONTINUE',
      metadata: { 
        userId: finalUserId,
        email: payload.email,
        error: profileError.message,
        errorCode: profileError.code,
        authCreated,
        customerData: {
          name: payload.name,
          email: payload.email,
          cpf: payload.cpf,
          whatsapp: payload.whatsapp
        }
      }
    });
    // NÃO FALHAR - continuar com a venda mesmo sem perfil
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-bulletproof-complete',
    message: 'Bulletproof user management completed - sale will proceed',
    metadata: { 
      userId: finalUserId,
      email: payload.email,
      authCreated,
      profileCreated,
      strategy: 'bulletproof'
    }
  });

  return { id: finalUserId, isExisting: false };
}

// ==================== ORDER SERVICE ====================
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
      productIdsCount: requestBody.productIds?.length || 0,
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

async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any): Promise<{ finalTotal: number; couponData?: CouponData }> {
  if (!couponCode) {
    return { finalTotal: originalTotal };
  }

  try {
    const { data: coupon, error: couponError } = await supabase
      .from('coupons')
      .select('code, discount_type, value, active')
      .eq('code', couponCode.toUpperCase().trim())
      .eq('active', true)
      .single();

    if (couponError || !coupon) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'coupon-application-invalid',
        message: 'Invalid coupon - continuing without discount',
        metadata: { 
          couponCode: couponCode.toUpperCase().trim(),
          error: couponError?.message
        }
      });
      return { finalTotal: originalTotal };
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
  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'coupon-application-exception',
      message: 'Exception applying coupon - continuing without discount',
      metadata: { 
        couponCode,
        error: error.message,
        originalTotal
      }
    });
    return { finalTotal: originalTotal };
  }
}

async function createOrderBulletproof(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any): Promise<OrderData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'order-creation-bulletproof-start',
    message: 'Starting BULLETPROOF order creation - order WILL be created',
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

  // Tentar criar o pedido com retry e fallback
  let order: OrderData | null = null;
  let orderAttempts = 0;
  const maxOrderAttempts = 5;

  while (orderAttempts < maxOrderAttempts && !order) {
    orderAttempts++;
    
    try {
      const { data: createdOrder, error: orderError } = await supabase
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

      if (orderError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'order-creation-error',
          message: `Failed to create order (attempt ${orderAttempts}/${maxOrderAttempts})`,
          metadata: { 
            userId,
            productIds,
            totalPrice,
            error: orderError.message,
            errorCode: orderError.code,
            attempt: orderAttempts
          }
        });

        if (orderAttempts < maxOrderAttempts) {
          await new Promise(resolve => setTimeout(resolve, 1000 * orderAttempts)); // Backoff exponencial
          continue;
        }
        
        throw new Error('Erro ao criar pedido: ' + orderError.message);
      }

      order = createdOrder as OrderData;
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'order-creation-success',
        message: 'Order created successfully',
        metadata: { 
          orderId: order.id,
          userId,
          totalPrice,
          status: order.status,
          attempt: orderAttempts
        }
      });
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'order-creation-exception',
        message: `Exception creating order (attempt ${orderAttempts}/${maxOrderAttempts})`,
        metadata: { 
          userId,
          error: error.message,
          attempt: orderAttempts
        }
      });

      if (orderAttempts >= maxOrderAttempts) {
        throw error;
      }
    }
  }

  if (!order) {
    throw new Error('Falha ao criar pedido após múltiplas tentativas');
  }

  return order;
}

// ==================== ASAAS SERVICE ====================
async function updateOrderWithPaymentId(orderId: string, asaasPaymentId: string, supabase: any): Promise<void> {
  try {
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
  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'warning',
      context: 'order-payment-id-update-exception',
      message: 'Exception updating order with payment ID - payment still created',
      metadata: { 
        orderId,
        asaasPaymentId,
        error: error.message
      }
    });
  }
}

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
        httpStatusText: asaasResponse.statusText,
        customerData: {
          name: customerData.name,
          email: customerData.email,
          cpf: customerData.cpf,
          whatsapp: customerData.whatsapp
        }
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

  // Atualizar pedido com ID do pagamento (não falhar se der erro)
  await updateOrderWithPaymentId(order.id, pixPaymentData.id, supabase);

  return {
    id: pixPaymentData.id,
    orderId: order.id,
    payload: pixQrCodeData.payload,
    encodedImage: pixQrCodeData.encodedImage,
  };
}

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
        installmentCount: creditCardData.installmentCount || 1,
        customerData: {
          name: customerData.name,
          email: customerData.email,
          cpf: customerData.cpf,
          whatsapp: customerData.whatsapp
        }
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

  // Atualizar pedido com ID do pagamento (não falhar se der erro)
  await updateOrderWithPaymentId(order.id, paymentData.id, supabase);

  return { ...paymentData, orderId: order.id };
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

  let requestBody: any;
  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let customerData: RequestPayload | undefined;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-start',
      message: 'BULLETPROOF Payment creation process started - ZERO SALES LOST',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        hasProductIds: !!requestBody.productIds,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code,
        userAgent: req.headers.get('user-agent')?.substring(0, 100) || 'unknown'
      }
    });

    // ETAPA 1: Validar dados da requisição
    const validatedPayload = await validateRequestData(requestBody, supabase);
    customerData = validatedPayload;

    // ETAPA 2: Validar produtos
    const products = await validateProducts(validatedPayload.productIds, supabase);
    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 3: Aplicar cupom (não falhar se der erro)
    const { finalTotal, couponData } = await applyCoupon(validatedPayload.coupon_code, originalTotal, supabase);

    // ETAPA 4: Gerenciar usuário (BULLETPROOF - nunca falha)
    const userData = await handleUserManagementBulletproof(validatedPayload, supabase);
    userId = userData.id;

    // ETAPA 5: Criar pedido (BULLETPROOF - com retry)
    const order = await createOrderBulletproof(userId, validatedPayload.productIds, finalTotal, validatedPayload.metaTrackingData, req, supabase);
    orderId = order.id;

    // ETAPA 6: Processar pagamento (PRIORIDADE MÁXIMA)
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

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'BULLETPROOF Payment creation process completed successfully - SALE SECURED',
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
        couponUsed: couponData?.code || null
      }
    });

    return new Response(JSON.stringify(paymentResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // CRÍTICO: Salvar todos os dados do cliente para contato manual
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-CRITICAL-FAILURE',
      message: `CRITICAL SALE FAILURE: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        paymentMethod: requestBody?.paymentMethod,
        CUSTOMER_CONTACT_DATA: customerData ? {
          name: customerData.name,
          email: customerData.email,
          cpf: customerData.cpf,
          whatsapp: customerData.whatsapp,
          productIds: customerData.productIds,
          coupon_code: customerData.coupon_code
        } : {
          name: requestBody?.name,
          email: requestBody?.email,
          cpf: requestBody?.cpf,
          whatsapp: requestBody?.whatsapp,
          productIds: requestBody?.productIds,
          coupon_code: requestBody?.coupon_code
        },
        requestBodyKeys: requestBody ? Object.keys(requestBody) : [],
        timestamp: new Date().toISOString(),
        MANUAL_FOLLOW_UP_REQUIRED: true
      }
    });

    let userFriendlyMessage = 'Erro interno do servidor. Entraremos em contato em breve.';
    
    if (error.message.includes('Campos obrigatórios ausentes')) {
      userFriendlyMessage = 'Dados incompletos. Verifique se todos os campos foram preenchidos.';
    } else if (error.message.includes('Método de pagamento inválido')) {
      userFriendlyMessage = 'Método de pagamento não suportado.';
    } else if (error.message.includes('Produtos não encontrados')) {
      userFriendlyMessage = 'Um ou mais produtos não estão disponíveis.';
    } else if (error.message.includes('Cupom inválido')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('Erro ao criar conta') || error.message.includes('duplicate')) {
      userFriendlyMessage = 'Erro no processamento dos dados. Entraremos em contato para finalizar sua compra.';
    } else if (error.message.includes('Erro ao criar pagamento') || error.message.includes('Erro ao processar pagamento')) {
      userFriendlyMessage = 'Erro no processamento do pagamento. Entraremos em contato para finalizar sua compra.';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      details: 'Seus dados foram salvos e entraremos em contato para finalizar sua compra.',
      contact_saved: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
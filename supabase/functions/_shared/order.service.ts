import { RequestPayload, ProductData, CouponData, OrderData } from './types.ts';

// Função para validar dados de entrada
export async function validateRequestData(requestBody: any, supabase: any): Promise<RequestPayload> {
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
export async function validateProducts(productIds: string[], supabase: any): Promise<ProductData[]> {
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
export async function applyCoupon(couponCode: string | undefined, originalTotal: number, supabase: any): Promise<{ finalTotal: number; couponData?: CouponData }> {
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
export async function createOrder(userId: string, productIds: string[], totalPrice: number, metaTrackingData: any, req: Request, supabase: any): Promise<OrderData> {
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
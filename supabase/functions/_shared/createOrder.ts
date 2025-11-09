import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface CreateOrderInput {
  supabase: any;
  userId: string;
  productIds: string[];
  totalPrice: number;
  metaTrackingData?: any;
}

interface CreateOrderOutput {
  order: any;
  orderId: string;
}

export async function createOrder({
  supabase,
  userId,
  productIds,
  totalPrice,
  metaTrackingData
}: CreateOrderInput): Promise<CreateOrderOutput> {
  console.log('📦 createOrder - Starting order creation', {
    userId,
    productIds,
    totalPrice,
    hasMetaTrackingData: !!metaTrackingData
  });

  // ETAPA 1: Criar o pedido no banco
  console.log('💾 Creating order in database');
  
  const clientIpAddress = '127.0.0.1'; // TODO: Get from request headers
  const clientUserAgent = 'checkout-app'; // TODO: Get from request headers

  const fullMetaTrackingData = {
    ...metaTrackingData,
    client_ip_address: clientIpAddress,
    client_user_agent: clientUserAgent,
  };

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
    console.error('❌ Failed to create order:', {
      userId,
      productIds,
      totalPrice,
      error: orderInsertError?.message,
      errorType: orderInsertError?.name,
      errorCode: orderInsertError?.code
    });

    await supabase.from('logs').insert({
      level: 'error',
      context: 'createOrder-insert',
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
    throw new Error(`Failed to create order: ${orderInsertError?.message || 'Unknown error'}`);
  }

  console.log('✅ Order created successfully:', {
    orderId: order.id,
    userId,
    totalPrice,
    status: order.status
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'createOrder-success',
    message: 'Order created successfully',
    metadata: { 
      orderId: order.id,
      userId,
      totalPrice,
      status: order.status,
      productCount: productIds.length
    }
  });

  return {
    order,
    orderId: order.id
  };
}
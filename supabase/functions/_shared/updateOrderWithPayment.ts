import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface UpdateOrderWithPaymentInput {
  supabase: any;
  orderId: string;
  asaasPaymentId: string;
}

export async function updateOrderWithPayment({
  supabase,
  orderId,
  asaasPaymentId
}: UpdateOrderWithPaymentInput): Promise<void> {
  console.log('🔄 updateOrderWithPayment - Starting order update', {
    orderId,
    asaasPaymentId
  });

  // ETAPA 1: Atualizar pedido com ID do pagamento
  console.log('💾 Updating order with payment ID');
  
  const { error: orderUpdateError } = await supabase
    .from('orders')
    .update({ asaas_payment_id: asaasPaymentId })
    .eq('id', orderId);

  if (orderUpdateError) {
    console.error('❌ Failed to update order with payment ID:', {
      orderId,
      asaasPaymentId,
      error: orderUpdateError.message,
      errorType: orderUpdateError.name
    });
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'updateOrderWithPayment-error',
      message: 'Failed to update order with payment ID',
      metadata: { 
        orderId,
        asaasPaymentId,
        error: orderUpdateError.message,
        errorType: orderUpdateError.name
      }
    });
    throw new Error(`Failed to update order with payment ID: ${orderUpdateError.message}`);
  }

  console.log('✅ Order updated successfully with payment ID:', {
    orderId,
    asaasPaymentId
  });

  await supabase.from('logs').insert({
    level: 'info',
    context: 'updateOrderWithPayment-success',
    message: 'Order updated successfully with payment ID',
    metadata: { 
      orderId,
      asaasPaymentId
    }
  });
}
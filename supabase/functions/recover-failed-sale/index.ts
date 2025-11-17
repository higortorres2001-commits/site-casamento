import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createOrUpdateUser, createOrder, validateProducts, validateAndApplyCoupon } from '../_shared/database.service.ts';
import { Logger } from '../_shared/logger.service.ts';

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

  const logger = new Logger(supabase, 'recover-sale');

  try {
    const { customerData, productIds, couponCode } = await req.json();

    logger.info('Sale recovery started', {
      email: customerData.email,
      productCount: productIds?.length || 0
    });

    // Validar produtos
    const products = await validateProducts(supabase, productIds);
    const originalTotal = products.reduce((sum, p) => sum + parseFloat(p.price.toString()), 0);

    // Aplicar cupom
    const { finalTotal } = await validateAndApplyCoupon(supabase, couponCode, originalTotal);

    // Criar/atualizar usuário
    const userResult = await createOrUpdateUser(supabase, {
      name: customerData.name,
      email: customerData.email,
      cpf: customerData.cpf.replace(/\D/g, ''),
      whatsapp: customerData.whatsapp.replace(/\D/g, '')
    });

    // Criar pedido
    const order = await createOrder(supabase, {
      userId: userResult.userId,
      productIds,
      totalPrice: finalTotal,
      metaTrackingData: { recovery: true }
    });

    logger.info('Sale recovered successfully', {
      orderId: order.id,
      userId: userResult.userId,
      isNewUser: userResult.isNew
    });

    return new Response(JSON.stringify({
      success: true,
      orderId: order.id,
      userId: userResult.userId,
      message: 'Venda recuperada com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await logger.critical('Sale recovery failed', {
      errorMessage: error.message,
      errorStack: error.stack
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
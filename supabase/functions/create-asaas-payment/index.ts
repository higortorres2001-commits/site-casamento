import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleUserManagement } from '../_shared/user.service.ts';
import { validateRequestData, validateProducts, applyCoupon, createOrder } from '../_shared/order.service.ts';
import { processPixPayment, processCreditCardPayment } from '../_shared/asaas.service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função principal - Orquestrador limpo
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
      message: 'Payment creation process started',
      metadata: { 
        paymentMethod: requestBody.paymentMethod,
        hasProductIds: !!requestBody.productIds,
        productCount: requestBody.productIds?.length || 0,
        hasCoupon: !!requestBody.coupon_code,
        userAgent: req.headers.get('user-agent')?.substring(0, 100) || 'unknown'
      }
    });

    // ETAPA 1: Validar dados de entrada
    const validatedPayload = await validateRequestData(requestBody, supabase);

    // ETAPA 2: Gerenciar usuário (existente ou novo)
    const userData = await handleUserManagement(validatedPayload, supabase);
    userId = userData.id;

    // ETAPA 3: Validar produtos
    const products = await validateProducts(validatedPayload.productIds, supabase);
    const originalTotal = products.reduce((sum, product) => sum + parseFloat(product.price.toString()), 0);

    // ETAPA 4: Aplicar cupom (se fornecido)
    const { finalTotal, couponData } = await applyCoupon(validatedPayload.coupon_code, originalTotal, supabase);

    // ETAPA 5: Criar pedido
    const order = await createOrder(userId, validatedPayload.productIds, finalTotal, validatedPayload.metaTrackingData, req, supabase);
    orderId = order.id;

    // ETAPA 6: Processar pagamento baseado no método escolhido
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

    // ETAPA 7: Log final de sucesso
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-success',
      message: 'Payment creation process completed successfully',
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
        requestBodyKeys: requestBody ? Object.keys(requestBody) : []
      }
    });

    // Retornar erro mais amigável para o usuário
    let userFriendlyMessage = 'Erro interno do servidor. Tente novamente em alguns minutos.';
    
    if (error.message.includes('Campos obrigatórios ausentes')) {
      userFriendlyMessage = 'Dados incompletos. Verifique se todos os campos foram preenchidos.';
    } else if (error.message.includes('Método de pagamento inválido')) {
      userFriendlyMessage = 'Método de pagamento não suportado.';
    } else if (error.message.includes('Produtos não encontrados')) {
      userFriendlyMessage = 'Um ou mais produtos não estão disponíveis.';
    } else if (error.message.includes('Cupom inválido')) {
      userFriendlyMessage = error.message;
    } else if (error.message.includes('Erro ao criar conta')) {
      userFriendlyMessage = 'Erro ao processar seus dados. Verifique as informações e tente novamente.';
    } else if (error.message.includes('Erro ao criar pagamento') || error.message.includes('Erro ao processar pagamento')) {
      userFriendlyMessage = 'Erro no processamento do pagamento. Verifique os dados do cartão e tente novamente.';
    }

    return new Response(JSON.stringify({ 
      error: userFriendlyMessage,
      details: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
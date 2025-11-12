import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleUserManagement, createOrUpdateUserProfile } from '../_shared/user.service.ts';
import { validateRequestData, validateProducts, applyCoupon, createOrder } from '../_shared/order.service.ts';
import { processPixPayment, processCreditCardPayment } from '../_shared/asaas.service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função principal
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
  let isExistingUser: boolean = false;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let validatedPayload: any;

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
        hasCreditCard: !!requestBody.creditCard
      }
    });

    // ETAPA 1: Validar dados de entrada
    validatedPayload = await validateRequestData(requestBody, supabase);

    // ETAPA 2: Gerenciar usuário (existente ou novo) - APENAS AUTH, SEM PROFILE
    const userData = await handleUserManagement(validatedPayload, supabase);
    userId = userData.id;
    isExistingUser = userData.isExisting;

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
    let paymentSuccessful = false;
    const clientIpAddress = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';

    try {
      if (validatedPayload.paymentMethod === 'PIX') {
        paymentResult = await processPixPayment(order, validatedPayload, supabase);
        asaasPaymentId = paymentResult.id;
        // PIX é considerado "pendente" até confirmação do webhook
        paymentSuccessful = false;
      } else if (validatedPayload.paymentMethod === 'CREDIT_CARD') {
        paymentResult = await processCreditCardPayment(order, validatedPayload, validatedPayload.creditCard, clientIpAddress, supabase);
        asaasPaymentId = paymentResult.id;
        // Cartão de crédito pode ser aprovado imediatamente
        paymentSuccessful = paymentResult.status === 'CONFIRMED' || paymentResult.status === 'RECEIVED';
      } else {
        throw new Error('Método de pagamento não suportado');
      }

      // ETAPA 7: Criar/atualizar perfil do usuário APENAS se pagamento com cartão foi bem-sucedido
      // Para PIX, o perfil será criado/atualizado pelo webhook quando o pagamento for confirmado
      if (paymentSuccessful) {
        await createOrUpdateUserProfile(userId, validatedPayload, isExistingUser, supabase);
        
        // Atualizar o status do pedido para 'paid'
        const { error: updateOrderError } = await supabase
          .from('orders')
          .update({ status: 'paid' })
          .eq('id', orderId);
          
        if (updateOrderError) {
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'order-status-update-error',
            message: 'Failed to update order status to paid after successful payment',
            metadata: { 
              orderId,
              error: updateOrderError.message
            }
          });
          // Não interrompemos o fluxo por causa deste erro
        }
      }

      // ETAPA 8: Log final de sucesso
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-asaas-payment-success',
        message: 'Payment creation process completed successfully',
        metadata: { 
          orderId,
          userId,
          asaasPaymentId,
          paymentMethod: validatedPayload.paymentMethod,
          paymentStatus: paymentResult.status,
          paymentSuccessful,
          profileCreated: paymentSuccessful,
          finalTotal,
          originalTotal,
          discountApplied: originalTotal - finalTotal,
          wasExistingUser: isExistingUser,
          productCount: validatedPayload.productIds.length,
          couponUsed: couponData?.code || null
        }
      });

      return new Response(JSON.stringify(paymentResult), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (paymentError: any) {
      // Se houver erro no processamento do pagamento, não criamos o perfil
      await supabase.from('logs').insert({
        level: 'error',
        context: 'payment-processing-error',
        message: `Payment processing failed: ${paymentError.message}`,
        metadata: {
          orderId,
          userId,
          paymentMethod: validatedPayload.paymentMethod,
          errorMessage: paymentError.message
        }
      });
      
      // Atualizar o status do pedido para 'cancelled' em caso de erro
      if (orderId) {
        await supabase
          .from('orders')
          .update({ status: 'cancelled' })
          .eq('id', orderId);
      }
      
      throw paymentError; // Relançar o erro para ser tratado pelo catch externo
    }

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
        hasCreditCard: !!(requestBody?.creditCard)
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
    } else if (error.message.includes('Número do cartão inválido')) {
      userFriendlyMessage = 'Número do cartão inválido. Verifique os dados e tente novamente.';
    } else if (error.message.includes('Mês de expiração inválido')) {
      userFriendlyMessage = 'Mês de expiração do cartão inválido.';
    } else if (error.message.includes('Ano de expiração inválido')) {
      userFriendlyMessage = 'Ano de expiração do cartão inválido.';
    } else if (error.message.includes('CVV inválido')) {
      userFriendlyMessage = 'CVV do cartão inválido.';
    } else if (error.message.includes('CEP inválido')) {
      userFriendlyMessage = 'CEP inválido. Use o formato XXXXX-XXX.';
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
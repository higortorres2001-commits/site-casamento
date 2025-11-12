import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { handleUserManagement } from '../_shared/user.service.ts';
import { validateRequestData, validateProducts, applyCoupon, createOrder } from '../_shared/order.service.ts';
import { processPixPayment, processCreditCardPayment } from '../_shared/asaas.service.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

// Função auxiliar para determinar em qual etapa o erro ocorreu
function getErrorStage(errorMessage: string): string {
  if (errorMessage.includes('Dados obrigatórios') || errorMessage.includes('CPF inválido')) {
    return 'validation';
  } else if (errorMessage.includes('CPF já cadastrado') || errorMessage.includes('Conflito crítico')) {
    return 'user_management';
  } else if (errorMessage.includes('perfil do usuário')) {
    return 'profile_verification';
  } else if (errorMessage.includes('não estão mais disponíveis')) {
    return 'product_validation';
  } else if (errorMessage.includes('Método de pagamento')) {
    return 'payment_method';
  } else if (errorMessage.includes('pagamento')) {
    return 'payment_processing';
  } else {
    return 'unknown';
  }
}
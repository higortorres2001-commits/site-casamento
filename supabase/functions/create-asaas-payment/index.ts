import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getOrCreateCustomer } from '../_shared/getOrCreateCustomer';
import { validateProducts } from '../_shared/validateProducts';
import { validateCoupon } from '../_shared/validateCoupon';
import { createOrder } from '../_shared/createOrder';
import { processPixPayment } from '../_shared/processPixPayment';
import { processCreditCardPayment } from '../_shared/processCreditCardPayment';
import { updateOrderWithPayment } from '../_shared/updateOrderWithPayment';

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

  try {
    const requestBody = await req.json();
    console.log('🚀 create-asaas-payment - Refactored function invoked', {
      requestBody: {
        ...requestBody,
        // Remover dados sensíveis do log
        creditCard: requestBody.creditCard ? 'PRESENT' : 'NOT_PRESENT',
        password: 'REDACTED'
      }
    });
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-refactored-start',
      message: 'Refactored payment processing started',
      metadata: { 
        hasName: !!requestBody.name,
        hasEmail: !!requestBody.email,
        hasCpf: !!requestBody.cpf,
        hasWhatsapp: !!requestBody.whatsapp,
        hasProductIds: !!requestBody.productIds,
        hasPaymentMethod: !!requestBody.paymentMethod,
        hasCoupon: !!requestBody.coupon_code
      }
    });

    const { 
      name, 
      email, 
      cpf, 
      whatsapp, 
      productIds, 
      coupon_code, 
      paymentMethod, 
      creditCard, 
      metaTrackingData 
    } = requestBody;

    // ETAPA 1: Obter ou criar cliente
    console.log('👤 Step 1: Get or create customer');
    const { userId, isNewUser } = await getOrCreateCustomer({
      supabase,
      email,
      name,
      cpf,
      whatsapp
    });

    console.log('✅ Step 1 completed:', { userId, isNewUser });

    // ETAPA 2: Validar produtos
    console.log('📦 Step 2: Validate products');
    const { products, totalPrice: originalTotalPrice } = await validateProducts({
      supabase,
      productIds
    });

    console.log('✅ Step 2 completed:', { 
      productCount: products.length, 
      originalTotalPrice 
    });

    // ETAPA 3: Validar cupom (se houver)
    console.log('🎫 Step 3: Validate coupon (if any)');
    const { coupon, finalPrice } = await validateCoupon({
      supabase,
      couponCode: coupon_code,
      originalTotalPrice
    });

    console.log('✅ Step 3 completed:', { 
      hasCoupon: !!coupon,
      finalPrice,
      discountAmount: originalTotalPrice - finalPrice
    });

    // ETAPA 4: Criar pedido
    console.log('📦 Step 4: Create order');
    const { order, orderId } = await createOrder({
      supabase,
      userId,
      productIds,
      totalPrice: finalPrice,
      metaTrackingData
    });

    console.log('✅ Step 4 completed:', { 
      orderId, 
      orderStatus: order.status,
      finalPrice 
    });

    // ETAPA 5: Processar pagamento
    console.log('💳 Step 5: Process payment');
    let paymentResult;
    
    if (paymentMethod === 'PIX') {
      paymentResult = await processPixPayment({
        supabase,
        name,
        email,
        cpfCnpj: cpf,
        phone: whatsapp,
        value: finalPrice,
        description: `Order #${orderId} payment`
      });
    } else if (paymentMethod === 'CREDIT_CARD') {
      if (!creditCard) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment-refactored',
          message: 'Credit card details missing for CREDIT_CARD payment method',
          metadata: { 
            orderId, 
            paymentMethod 
          }
        });
        return new Response(JSON.stringify({ 
          error: 'Credit card details are required for CREDIT_CARD payment method' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      paymentResult = await processCreditCardPayment({
        supabase,
        name,
        email,
        cpfCnpj: cpf,
        phone: whatsapp,
        postalCode: creditCard.postalCode,
        addressNumber: creditCard.addressNumber,
        value: finalPrice,
        description: `Order #${orderId} payment`,
        holderName: creditCard.holderName,
        cardNumber: creditCard.cardNumber,
        expiryMonth: creditCard.expiryMonth,
        expiryYear: creditCard.expiryYear,
        ccv: creditCard.ccv,
        installmentCount: creditCard.installmentCount,
        installmentValue: creditCard.installmentValue
      });
    } else {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment-refactored',
        message: 'Invalid payment method',
        metadata: { 
          orderId, 
          paymentMethod 
        }
      });
      return new Response(JSON.stringify({ 
        error: 'Invalid payment method' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Step 5 completed:', { 
      paymentMethod,
      paymentId: paymentResult.paymentId
    });

    // ETAPA 6: Atualizar pedido com ID do pagamento
    console.log('🔄 Step 6: Update order with payment ID');
    await updateOrderWithPayment({
      supabase,
      orderId,
      asaasPaymentId: paymentResult.paymentId
    });

    console.log('✅ Step 6 completed');

    // ETAPA 7: Preparar resposta
    console.log('📋 Step 7: Prepare response');
    const responseData = {
      ...paymentResult,
      orderId: orderId,
      isNewUser,
      finalPrice,
      originalTotalPrice,
      coupon: coupon ? {
        code: coupon.code,
        discount_type: coupon.discount_type,
        value: coupon.value
      } : null
    };

    console.log('✅ Step 7 completed:', {
      responseDataKeys: Object.keys(responseData),
      hasPaymentId: !!responseData.id,
      hasOrderId: !!responseData.orderId,
      hasQrCode: !!responseData.qrCodeData,
      hasAuthorizationCode: !!responseData.authorizationCode
    });

    // ETAPA 8: Log final de sucesso
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-asaas-payment-refactored-success',
      message: 'Refactored payment processing completed successfully',
      metadata: { 
        userId,
        orderId,
        paymentId: paymentResult.paymentId,
        paymentMethod,
        isNewUser,
        finalPrice,
        hasCoupon: !!coupon,
        productCount: productIds.length
      }
    });

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ create-asaas-payment-refactored - Unhandled error:', error);
    
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment-refactored-unhandled',
      message: `Unhandled error in refactored function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        requestBody: {
          ...req.body,
          // Remover dados sensíveis
          creditCard: req.body?.creditCard ? 'PRESENT' : 'NOT_PRESENT',
          password: 'REDACTED'
        }
      }
    });
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
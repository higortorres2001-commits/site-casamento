import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { createOrUpdateUser, createOrder, updateOrderStatus, validateProducts, validateAndApplyCoupon } from '../_shared/database.service.ts';
import { createPixPayment, createCreditCardPayment } from '../_shared/payment.service.ts';
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

  const logger = new Logger(supabase, 'create-payment');
  
  let requestBody: any;
  let userId: string | undefined;
  let orderId: string | undefined;

  try {
    requestBody = await req.json();
    
    logger.info('Payment creation started', {
      paymentMethod: requestBody.paymentMethod,
      productCount: requestBody.productIds?.length || 0,
      hasCoupon: !!requestBody.coupon_code
    });

    // ==================== VALIDAÇÕES ====================
    const { name, email, cpf, whatsapp, productIds, coupon_code, paymentMethod, creditCard, metaTrackingData } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !paymentMethod) {
      throw new Error('Campos obrigatórios ausentes');
    }

    if (!['PIX', 'CREDIT_CARD'].includes(paymentMethod)) {
      throw new Error('Método de pagamento inválido');
    }

    if (paymentMethod === 'CREDIT_CARD' && !creditCard) {
      throw new Error('Dados do cartão são obrigatórios');
    }

    // ==================== VALIDAR PRODUTOS ====================
    const products = await validateProducts(supabase, productIds);
    const originalTotal = products.reduce((sum, p) => sum + parseFloat(p.price.toString()), 0);

    logger.info('Products validated', {
      productCount: products.length,
      originalTotal
    });

    // ==================== APLICAR CUPOM ====================
    const { finalTotal, coupon } = await validateAndApplyCoupon(supabase, coupon_code, originalTotal);

    if (coupon) {
      logger.info('Coupon applied', {
        couponCode: coupon.code,
        discountType: coupon.discount_type,
        originalTotal,
        finalTotal,
        discount: originalTotal - finalTotal
      });
    }

    // ==================== CRIAR/ATUALIZAR USUÁRIO ====================
    const userResult = await createOrUpdateUser(supabase, {
      name,
      email,
      cpf: cpf.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, '')
    });

    userId = userResult.userId;

    logger.info('User processed', {
      userId,
      isNew: userResult.isNew,
      email: userResult.profile.email
    });

    // ==================== CRIAR PEDIDO ====================
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || '';

    const order = await createOrder(supabase, {
      userId,
      productIds,
      totalPrice: finalTotal,
      metaTrackingData: {
        ...metaTrackingData,
        client_ip_address: clientIp,
        client_user_agent: userAgent,
        event_source_url: metaTrackingData?.event_source_url || '',
      }
    });

    orderId = order.id;

    logger.info('Order created', {
      orderId,
      userId,
      totalPrice: finalTotal,
      status: order.status
    });

    // ==================== PROCESSAR PAGAMENTO ====================
    // Preparar dados do cliente limpos
    const customerData = {
      name,
      email,
      cpf: cpf.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, '')
    };

    // Log para debug do formato do customer
    logger.info('Customer data being sent to Asaas', {
      customerObject: {
        name: customerData.name,
        email: customerData.email,
        cpfCnpj: customerData.cpf,
        phone: customerData.whatsapp
      }
    });

    let paymentResult;

    if (paymentMethod === 'PIX') {
      paymentResult = await createPixPayment(
        orderId,
        customerData,
        finalTotal
      );

      logger.info('PIX payment created', {
        orderId,
        paymentId: paymentResult.id,
        status: paymentResult.status
      });
    } else {
      paymentResult = await createCreditCardPayment(
        orderId,
        customerData,
        creditCard,
        finalTotal,
        clientIp
      );

      logger.info('Credit card payment created', {
        orderId,
        paymentId: paymentResult.id,
        status: paymentResult.status,
        installments: creditCard.installmentCount || 1
      });
    }

    // ==================== ATUALIZAR PEDIDO COM PAYMENT ID ====================
    await updateOrderStatus(supabase, orderId, 'pending', paymentResult.id);

    logger.info('Payment creation completed successfully', {
      orderId,
      userId,
      paymentId: paymentResult.id,
      paymentMethod,
      finalTotal
    });

    return new Response(JSON.stringify(paymentResult), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // Log crítico que DEVE ser salvo
    await logger.critical('Payment creation failed', {
      errorMessage: error.message,
      errorStack: error.stack,
      userId,
      orderId,
      customerData: requestBody ? {
        name: requestBody.name,
        email: requestBody.email,
        cpf: requestBody.cpf ? 'PROVIDED' : 'MISSING',
        whatsapp: requestBody.whatsapp ? 'PROVIDED' : 'MISSING',
        productIds: requestBody.productIds,
        coupon_code: requestBody.coupon_code
      } : null,
      paymentMethod: requestBody?.paymentMethod,
      MANUAL_RECOVERY_REQUIRED: true
    });

    return new Response(JSON.stringify({ 
      error: error.message,
      orderId: orderId || null,
      userId: userId || null,
      recoverable: true
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
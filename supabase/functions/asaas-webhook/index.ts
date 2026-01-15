import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import {
  generateGiftReceiptEmail,
  generateFirstGiftEmail,
  sendEmail
} from '../_shared/email-templates.ts';

// Classe para logging
class Logger {
  private supabase;
  private context: string;

  constructor(supabase, context: string) {
    this.supabase = supabase;
    this.context = context;
  }

  async info(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'info',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async warning(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'warning',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async error(message: string, metadata?: any): Promise<void> {
    this.supabase.from('logs').insert({
      level: 'error',
      context: this.context,
      message,
      metadata: metadata || {}
    }).then(({ error }) => {
      if (error) {
        console.error('Failed to write log:', error);
      }
    });
  }

  async critical(message: string, metadata?: any): Promise<void> {
    await this.supabase.from('logs').insert({
      level: 'error',
      context: this.context,
      message: `CRITICAL: ${message}`,
      metadata: {
        ...metadata,
        CRITICAL: true,
        REQUIRES_IMMEDIATE_ACTION: true,
        timestamp: new Date().toISOString()
      }
    });
  }
}

/**
 * Valida assinatura do webhook Asaas (se configurada)
 */
function validateWebhookSignature(req: Request): boolean {
  const asaasToken = req.headers.get('asaas-access-token');
  const expectedToken = Deno.env.get('ASAAS_WEBHOOK_TOKEN');

  // Se não houver token configurado, aceitar (para compatibilidade)
  if (!expectedToken) {
    return true;
  }

  return asaasToken === expectedToken;
}

/**
 * Atualiza status do pedido de forma atômica
 */
async function updateOrderStatus(
  supabase,
  orderId: string,
  status: 'pending' | 'paid' | 'cancelled',
  asaasPaymentId?: string
): Promise<void> {
  const updateData: any = { status };

  if (asaasPaymentId) {
    updateData.asaas_payment_id = asaasPaymentId;
  }

  const { error } = await supabase
    .from('orders')
    .update(updateData)
    .eq('id', orderId);

  if (error) {
    throw new Error(`Erro ao atualizar status do pedido: ${error.message}`);
  }
}
/**
 * Concede acesso aos produtos de forma atômica e idempotente
 * Se algum produto for um Kit, expande para incluir todos os produtos do kit
 * SEGURO: Funciona mesmo se as colunas is_kit/kit_product_ids não existirem
 */
async function grantProductAccess(
  supabase,
  userId: string,
  productIds: string[]
): Promise<void> {
  // Começar com os IDs originais
  let expandedProductIds = [...productIds];

  try {
    // Tentar buscar informações de kit (pode falhar se colunas não existem)
    const { data: productsData, error: productsError } = await supabase
      .from('products')
      .select('id, is_kit, kit_product_ids')
      .in('id', productIds);

    if (productsError) {
      // Se erro (ex: coluna não existe), apenas logar e continuar com IDs originais
      console.warn('Aviso ao buscar info de kit (colunas podem não existir):', productsError.message);
    } else if (productsData && Array.isArray(productsData)) {
      // Expandir kits: se um produto é um kit, adicionar todos os produtos do kit
      for (const product of productsData) {
        // Validação defensiva: verificar se campos existem e são válidos
        const isKit = Boolean(product?.is_kit);
        const kitProductIds = product?.kit_product_ids;

        if (isKit && kitProductIds && Array.isArray(kitProductIds) && kitProductIds.length > 0) {
          // Filtrar IDs válidos (não nulos, strings não vazias)
          const validKitIds = kitProductIds.filter((id: any) => id && typeof id === 'string');
          if (validKitIds.length > 0) {
            expandedProductIds = [...expandedProductIds, ...validKitIds];
            console.log(`Kit expandido: ${product.id} -> ${validKitIds.length} produtos`);
          }
        }
      }
    }
  } catch (err) {
    // Qualquer erro na expansão de kit não deve impedir o grant de acesso
    console.warn('Erro ao processar expansão de kit (continuando com IDs originais):', err);
  }

  // Remover duplicatas
  expandedProductIds = [...new Set(expandedProductIds)];

  // Buscar acesso atual
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('access')
    .eq('id', userId)
    .single();

  if (fetchError) {
    throw new Error(`Erro ao buscar perfil: ${fetchError.message}`);
  }

  const currentAccess = Array.isArray(profile.access) ? profile.access : [];
  const newAccess = [...new Set([...currentAccess, ...expandedProductIds])];

  // Verificar se já tem todos os acessos (idempotência)
  const hasAllAccess = expandedProductIds.every(id => currentAccess.includes(id));

  if (hasAllAccess) {
    return; // Já tem acesso, nada a fazer
  }

  // Atualizar com novo acesso
  const { error: updateError } = await supabase
    .from('profiles')
    .update({
      access: newAccess,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId);

  if (updateError) {
    throw new Error(`Erro ao conceder acesso: ${updateError.message}`);
  }
}

/**
 * Envia email de acesso liberado
 */
async function sendAccessEmail(
  email: string,
  name: string,
  cpf: string,
  logger: Logger
): Promise<void> {
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

  if (!RESEND_API_KEY) {
    logger.warning('Resend API key not configured, skipping email');
    return;
  }

  const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'https://seu-app.com';
  const loginUrl = 'https://app.medsemestress.com';

  const emailBody = `
    <h2>Parabéns! Seu pagamento foi confirmado 🎉</h2>
    <p>Seu acesso aos produtos foi liberado. Use os dados abaixo para fazer login:</p>
    <ul>
      <li><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></li>
      <li><strong>Email:</strong> ${email}</li>
      <li><strong>Senha:</strong> ${cpf} (os números do seu CPF)</li>
    </ul>
    <p><em>Recomendamos trocar sua senha no primeiro acesso.</em></p>
  `;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'contato@medsemestress.com',
        to: email,
        subject: 'Seu acesso foi liberado!',
        html: emailBody,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Failed to send access email', { email, error: errorData });
    } else {
      logger.info('Access email sent successfully', { email });
    }
  } catch (error: any) {
    logger.error('Exception sending email', { email, error: error.message });
  }
}

/**
 * Envia evento Purchase para Meta CAPI
 */
async function sendMetaPurchaseEvent(
  order: any,
  profile: any,
  logger: Logger
): Promise<void> {
  const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID');
  const META_CAPI_ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN');

  if (!META_PIXEL_ID || !META_CAPI_ACCESS_TOKEN) {
    logger.warning('Meta Pixel not configured, skipping CAPI event');
    return;
  }

  try {
    // Hash SHA-256 dos dados
    const hashSHA256 = async (text: string): Promise<string> => {
      const encoder = new TextEncoder();
      const data = encoder.encode(text.toLowerCase().trim());
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    };

    const hashedEmail = profile.email ? await hashSHA256(profile.email) : undefined;
    const hashedPhone = profile.whatsapp ? await hashSHA256(profile.whatsapp) : undefined;

    const capiPayload = {
      data: [{
        event_name: 'Purchase',
        event_time: Math.floor(Date.now() / 1000),
        event_source_url: order.meta_tracking_data?.event_source_url || '',
        action_source: 'website',
        user_data: {
          em: hashedEmail,
          ph: hashedPhone,
          fbc: order.meta_tracking_data?.fbc,
          fbp: order.meta_tracking_data?.fbp,
          client_ip_address: order.meta_tracking_data?.client_ip_address,
          client_user_agent: order.meta_tracking_data?.client_user_agent,
        },
        custom_data: {
          value: parseFloat(order.total_price).toFixed(2),
          currency: 'BRL',
          order_id: order.id,
        },
        event_id: `purchase_${order.id}_${Date.now()}`,
      }],
    };

    const response = await fetch(
      `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(capiPayload),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      logger.error('Meta CAPI error', { error: errorData });
    } else {
      logger.info('Meta Purchase event sent successfully');
    }
  } catch (error: any) {
    logger.error('Exception sending Meta event', { error: error.message });
  }
}

/**
 * Background processing function for gift payments
 * Runs after HTTP 200 is returned to Asaas
 */
async function processGiftPaymentInBackground(
  supabase: any,
  logger: Logger,
  giftReservationId: string,
  reservationGiftId: string,
  reservationQuantity: number
): Promise<void> {
  try {
    // Update gift quantity_purchased
    const { data: gift } = await supabase
      .from('gifts')
      .select('id, quantity_purchased, wedding_list_id')
      .eq('id', reservationGiftId)
      .single();

    if (gift) {
      await supabase
        .from('gifts')
        .update({
          quantity_purchased: (gift.quantity_purchased || 0) + reservationQuantity
        })
        .eq('id', gift.id);

      logger.info('Gift quantity updated', {
        giftId: gift.id,
        addedQuantity: reservationQuantity,
        newTotal: (gift.quantity_purchased || 0) + reservationQuantity
      });

      // ==================== EMAIL NOTIFICATIONS ====================
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Lista de Casamento <noreply@listadecasamento.com>';
      const APP_URL = Deno.env.get('APP_URL') || 'https://listadecasamento.com';

      if (RESEND_API_KEY) {
        // Fetch full reservation data for email
        const { data: fullReservation } = await supabase
          .from('gift_reservations')
          .select('guest_name, guest_email, total_price, quantity')
          .eq('id', giftReservationId)
          .single();

        // Fetch gift and wedding list details
        const { data: giftDetails } = await supabase
          .from('gifts')
          .select(`
            name, 
            price,
            wedding_list_id,
            wedding_lists(
              id,
              bride_name, 
              groom_name, 
              user_id, 
              first_gift_notified,
              notification_email,
              profiles!wedding_lists_user_id_fkey(email)
            )
          `)
          .eq('id', gift.id)
          .single();

        if (giftDetails && fullReservation) {
          const weddingList = (giftDetails as any).wedding_lists;
          const coupleNames = `${weddingList.bride_name} & ${weddingList.groom_name}`;
          const coupleEmail = weddingList.notification_email || weddingList.profiles?.email;

          // 1. Send receipt to guest
          if (fullReservation.guest_email) {
            const receiptEmail = generateGiftReceiptEmail({
              guestName: fullReservation.guest_name,
              giftName: giftDetails.name,
              amount: fullReservation.total_price || giftDetails.price,
              quantity: fullReservation.quantity,
              coupleNames,
            });

            const receiptResult = await sendEmail(
              RESEND_API_KEY,
              fullReservation.guest_email,
              receiptEmail,
              { from: EMAIL_FROM }
            );

            if (receiptResult.success) {
              logger.info('Gift receipt sent to guest', { email: fullReservation.guest_email });
            } else {
              logger.warning('Failed to send gift receipt', { error: receiptResult.error });
            }
          }

          // 2. Check if this is the FIRST gift
          if (coupleEmail && !weddingList.first_gift_notified) {
            const firstGiftEmail = generateFirstGiftEmail({
              coupleNames,
              guestName: fullReservation.guest_name,
              giftName: giftDetails.name,
              amount: fullReservation.total_price || giftDetails.price,
              dashboardUrl: `${APP_URL}/dashboard`,
            });

            const firstGiftResult = await sendEmail(
              RESEND_API_KEY,
              coupleEmail,
              firstGiftEmail,
              { from: EMAIL_FROM }
            );

            if (firstGiftResult.success) {
              logger.info('First gift celebration email sent', { email: coupleEmail });
              await supabase
                .from('wedding_lists')
                .update({ first_gift_notified: true })
                .eq('id', weddingList.id);
            } else {
              logger.warning('Failed to send first gift email', { error: firstGiftResult.error });
            }
          }
        }
      }
    }

    logger.info('Gift background processing completed', { giftReservationId });
  } catch (error: any) {
    logger.error('Gift background processing failed', {
      giftReservationId,
      error: error.message
    });
  }
}

/**
 * Background processing function for regular orders
 * Runs after HTTP 200 is returned to Asaas
 */
async function processOrderInBackground(
  supabase: any,
  logger: Logger,
  order: any,
  payload: any
): Promise<void> {
  try {
    // ==================== CONCEDER ACESSO ====================
    await grantProductAccess(supabase, order.user_id, order.ordered_product_ids);

    logger.info('Product access granted', {
      orderId: order.id,
      userId: order.user_id,
      productCount: order.ordered_product_ids.length
    });

    // ==================== BUSCAR PERFIL PARA EMAIL ====================
    const { data: profile } = await supabase
      .from('profiles')
      .select('email, name, cpf, whatsapp')
      .eq('id', order.user_id)
      .single();

    if (profile?.email && profile?.cpf) {
      // Enviar email (não-bloqueante)
      sendAccessEmail(profile.email, profile.name, profile.cpf, logger);
      // Enviar evento Meta (não-bloqueante)
      sendMetaPurchaseEvent(order, profile, logger);
    }

    logger.info('Order background processing completed', {
      orderId: order.id,
      userId: order.user_id,
      event: payload.event
    });
  } catch (error: any) {
    logger.error('Order background processing failed', {
      orderId: order.id,
      error: error.message
    });
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const logger = new Logger(supabase, 'asaas-webhook');
  let payload: any;

  try {
    // Validar assinatura do webhook
    if (!validateWebhookSignature(req)) {
      logger.error('Invalid webhook signature');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    payload = await req.json();

    // ==================== QUICK RESPONSE FOR NON-RELEVANT EVENTS ====================
    // Retorna HTTP 200 IMEDIATAMENTE para evitar penalização do Asaas
    const relevantEvents = ['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'];
    if (!relevantEvents.includes(payload.event)) {
      logger.info('Event acknowledged (not processed)', {
        event: payload.event,
        paymentId: payload.payment?.id
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Event acknowledged',
        event: payload.event
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentId = payload.payment?.id;
    const externalReference = payload.payment?.externalReference || '';

    if (!asaasPaymentId) {
      throw new Error('Payment ID not found in webhook');
    }

    // ==================== GIFT PAYMENT FLOW ====================
    if (externalReference.startsWith('gift_')) {
      const giftReservationId = externalReference.replace('gift_', '');

      // Fetch gift reservation - operação CRÍTICA, deve ser síncrona
      const { data: reservation, error: reservationError } = await supabase
        .from('gift_reservations')
        .select('id, gift_id, quantity, status')
        .eq('id', giftReservationId)
        .single();

      if (reservationError || !reservation) {
        logger.warning('Gift reservation not found', { giftReservationId });
        return new Response(JSON.stringify({
          success: true,
          message: 'Gift reservation not found'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Idempotency check
      if (reservation.status === 'purchased') {
        return new Response(JSON.stringify({
          success: true,
          message: 'Already processed'
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // CRITICAL: Update status IMEDIATAMENTE (operação essencial)
      await supabase
        .from('gift_reservations')
        .update({
          status: 'purchased',
          payment_confirmed_at: new Date().toISOString()
        })
        .eq('id', giftReservationId);

      logger.info('Gift payment confirmed', {
        asaasPaymentId,
        giftReservationId,
        giftId: reservation.gift_id
      });

      // BACKGROUND: Processar emails e atualizações secundárias
      // Não aguardamos - permite resposta rápida ao Asaas
      processGiftPaymentInBackground(
        supabase,
        logger,
        giftReservationId,
        reservation.gift_id,
        reservation.quantity
      ).catch(err => console.error('Background gift processing error:', err));

      // Resposta IMEDIATA para Asaas
      return new Response(JSON.stringify({
        success: true,
        message: 'Gift payment confirmed',
        giftReservationId,
        giftId: reservation.gift_id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== REGULAR ORDER PAYMENT FLOW ====================
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status, total_price, meta_tracking_data')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      logger.warning('Order not found for payment', { asaasPaymentId });
      return new Response(JSON.stringify({
        success: true,
        message: 'Order not found'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotency check
    if (order.status === 'paid') {
      return new Response(JSON.stringify({
        success: true,
        message: 'Already processed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // CRITICAL: Atualizar status IMEDIATAMENTE (operação essencial)
    await updateOrderStatus(supabase, order.id, 'paid');

    logger.info('Order payment confirmed', {
      orderId: order.id,
      userId: order.user_id,
      asaasPaymentId
    });

    // BACKGROUND: Processar acesso, emails e Meta CAPI
    // Não aguardamos - permite resposta rápida ao Asaas
    processOrderInBackground(supabase, logger, order, payload)
      .catch(err => console.error('Background order processing error:', err));

    // Resposta IMEDIATA para Asaas
    return new Response(JSON.stringify({
      success: true,
      message: 'Payment confirmed',
      orderId: order.id,
      userId: order.user_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    // IMPORTANT: Mesmo em erro, logamos e retornamos rapidamente
    logger.critical('Webhook processing failed', {
      errorMessage: error.message,
      errorStack: error.stack,
      payload: payload || null
    });

    // Retorna 200 mesmo em erro para evitar re-tentativas infinitas do Asaas
    // O erro foi logado para investigação manual
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 200, // Changed from 500 to 200 to prevent Asaas penalties
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
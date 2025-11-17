import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
};

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
 */
async function grantProductAccess(
  supabase,
  userId: string,
  productIds: string[]
): Promise<void> {
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
  const newAccess = [...new Set([...currentAccess, ...productIds])];

  // Verificar se já tem todos os acessos (idempotência)
  const hasAllAccess = productIds.every(id => currentAccess.includes(id));
  
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
  const loginUrl = `${appUrl}/login`;
  
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
      //body: JSON.stringify({
      //  from: 'onboarding@resend.dev',
      //  to: email,
     //   subject: 'Seu acesso foi liberado!',
   //     html: emailBody,
  //    }),
   // });
      body: JSON.stringify({
        from: 'contato@medsemestress.com', //  MUITO IMPORTANTE!
        to: email,
        template_id: 'f24271ee-3730-454d-921b-ef9cee46be39I', // O ID que você copiou do Resend
        params: {
          // As variáveis que você definiu no template
          loginUrl: loginUrl,
          email: email,
          cpf: cpf}),
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

serve(async (req) => {
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
    
    logger.info('Webhook received', {
      event: payload.event,
      paymentId: payload.payment?.id
    });

    // Processar apenas eventos relevantes
    if (!['PAYMENT_CONFIRMED', 'PAYMENT_RECEIVED'].includes(payload.event)) {
      logger.info('Event ignored (not relevant)', { event: payload.event });
      return new Response(JSON.stringify({ message: 'Event ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentId = payload.payment?.id;
    
    if (!asaasPaymentId) {
      throw new Error('Payment ID not found in webhook');
    }

    // ==================== BUSCAR PEDIDO ====================
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status, total_price, meta_tracking_data')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      logger.warning('Order not found for payment', { asaasPaymentId });
      return new Response(JSON.stringify({ message: 'Order not found' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se já foi processado (idempotência)
    if (order.status === 'paid') {
      logger.info('Order already processed (idempotent)', {
        orderId: order.id,
        userId: order.user_id
      });
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ==================== ATUALIZAR STATUS ====================
    await updateOrderStatus(supabase, order.id, 'paid');

    logger.info('Order status updated to paid', {
      orderId: order.id,
      userId: order.user_id
    });

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

    logger.info('Webhook processed successfully', {
      orderId: order.id,
      userId: order.user_id,
      event: payload.event
    });

    return new Response(JSON.stringify({ 
      message: 'Webhook processed successfully',
      orderId: order.id,
      userId: order.user_id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await logger.critical('Webhook processing failed', {
      errorMessage: error.message,
      errorStack: error.stack,
      payload: payload || null
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
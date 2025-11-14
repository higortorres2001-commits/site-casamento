import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para hash SHA-256
async function sha256Hash(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text.toLowerCase().trim());
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Função auxiliar para aguardar (sleep)
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para buscar usuário com retry
async function findUserWithRetry(supabase: any, email: string, maxRetries = 3, delayMs = 2000): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'webhook-user-lookup',
      message: `Attempting to find user in Auth (attempt ${attempt}/${maxRetries})`,
      metadata: { email, attempt, maxRetries }
    });

    const { data: users, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'webhook-user-lookup-error',
        message: `Error listing users (attempt ${attempt}/${maxRetries})`,
        metadata: { email, attempt, error: error.message }
      });
      
      if (attempt === maxRetries) {
        throw new Error('Failed to list users after retries: ' + error.message);
      }
      
      await sleep(delayMs);
      continue;
    }

    const user = users.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (user) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'webhook-user-found',
        message: `User found in Auth on attempt ${attempt}`,
        metadata: { userId: user.id, email, attempt }
      });
      return user;
    }

    await supabase.from('logs').insert({
      level: 'warning',
      context: 'webhook-user-not-found',
      message: `User not found in Auth (attempt ${attempt}/${maxRetries}), will retry`,
      metadata: { email, attempt, maxRetries, willRetry: attempt < maxRetries }
    });

    if (attempt < maxRetries) {
      await sleep(delayMs);
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let requestBody: any;

  try {
    requestBody = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'asaas-webhook-received',
      message: 'Asaas Webhook received',
      metadata: { 
        event: requestBody.event,
        paymentId: requestBody.payment?.id,
        timestamp: new Date().toISOString()
      }
    });

    // ETAPA 1: Verificar se é evento relevante
    if (requestBody.event !== 'PAYMENT_CONFIRMED' && requestBody.event !== 'PAYMENT_RECEIVED') {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'webhook-event-ignored',
        message: 'Event not relevant, ignoring',
        metadata: { event: requestBody.event }
      });
      
      return new Response(JSON.stringify({ message: 'Event not relevant, ignored.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    asaasPaymentId = requestBody.payment?.id;
    
    if (!asaasPaymentId) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'webhook-missing-payment-id',
        message: 'Payment ID not found in webhook payload',
        metadata: { event: requestBody.event, payload: requestBody }
      });
      
      return new Response(JSON.stringify({ error: 'Payment ID not found in notification.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 2: Buscar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, user_id, ordered_product_ids, status, total_price, meta_tracking_data')
      .eq('asaas_payment_id', asaasPaymentId)
      .single();

    if (orderError || !order) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'webhook-order-not-found',
        message: 'Order not found for payment ID',
        metadata: { 
          asaasPaymentId, 
          error: orderError?.message,
          errorCode: orderError?.code
        }
      });
      
      return new Response(JSON.stringify({ message: 'Order not found, webhook acknowledged.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    orderId = order.id;
    userId = order.user_id;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'webhook-order-found',
      message: 'Order found successfully',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        currentStatus: order.status,
        productCount: order.ordered_product_ids?.length || 0
      }
    });

    // ETAPA 3: Atualizar status do pedido
    const newStatus = 'paid';
    
    if (order.status !== 'paid') {
      const { error: updateOrderError } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', order.id);

      if (updateOrderError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'webhook-order-update-error',
          message: 'Failed to update order status',
          metadata: { 
            orderId, 
            asaasPaymentId, 
            error: updateOrderError.message,
            errorCode: updateOrderError.code
          }
        });
        
        return new Response(JSON.stringify({ error: 'Failed to update order status.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'webhook-order-updated',
        message: 'Order status updated to paid',
        metadata: { 
          orderId, 
          asaasPaymentId, 
          oldStatus: order.status,
          newStatus
        }
      });
    }

    // ETAPA 4: Buscar perfil do usuário (COM RETRY)
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, access, name, email, cpf, whatsapp')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'webhook-profile-not-found',
        message: 'CRITICAL: User profile not found - this should not happen with new flow',
        metadata: { 
          userId, 
          orderId, 
          asaasPaymentId, 
          error: profileError?.message,
          errorCode: profileError?.code
        }
      });
      
      // Retornar 202 para que Asaas retente
      return new Response(JSON.stringify({ 
        message: 'User profile not found, please retry webhook.',
        orderId,
        userId
      }), {
        status: 202, // Accepted - Asaas will retry
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 5: Liberar acesso aos produtos
    const orderedProductIds = order.ordered_product_ids || [];
    const existingAccess = profile.access || [];
    const newAccess = [...new Set([...existingAccess, ...orderedProductIds])];

    // Verificar se já tem acesso (idempotência)
    const hasAllAccess = orderedProductIds.every(id => existingAccess.includes(id));
    
    if (hasAllAccess) {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'webhook-access-already-granted',
        message: 'User already has access to all products (idempotent webhook)',
        metadata: { 
          userId, 
          orderId, 
          asaasPaymentId, 
          existingAccessCount: existingAccess.length,
          orderedProductIds
        }
      });
    } else {
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ access: newAccess })
        .eq('id', userId);

      if (updateProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'webhook-access-grant-error',
          message: 'Failed to grant product access to user',
          metadata: { 
            userId, 
            orderId, 
            asaasPaymentId, 
            orderedProductIds, 
            error: updateProfileError.message,
            errorCode: updateProfileError.code
          }
        });
        
        return new Response(JSON.stringify({ error: 'Failed to grant product access.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      await supabase.from('logs').insert({
        level: 'info',
        context: 'webhook-access-granted',
        message: 'Product access granted successfully',
        metadata: { 
          userId, 
          orderId, 
          asaasPaymentId, 
          previousAccessCount: existingAccess.length,
          newAccessCount: newAccess.length,
          grantedProducts: orderedProductIds
        }
      });
    }

    // ETAPA 6: Enviar email de acesso liberado COM TEMPLATE purchase-confirmation
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (RESEND_API_KEY && profile.email && profile.cpf) {
      const emailSubject = "🎉 Parabéns! Seu acesso foi liberado!";
      const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'https://app.medsemestress.com';
      const loginUrl = `${appUrl}/login`;
      
      // Construir lista de produtos para o template
      const productNames = orderedProductIds.length > 0 
        ? await getProductNames(orderedProductIds, supabase)
        : ['Produto não identificado'];

      const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #28a745; font-size: 28px; margin-bottom: 10px;">🎉 Compra Confirmada!</h1>
            <p style="color: #6c757d; font-size: 16px; margin: 0;">Parabéns! Seu pagamento foi confirmado com sucesso.</p>
          </div>
          
          <div style="background-color: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">📦 Seus Dados de Acesso</h2>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 15px;">
              <p style="margin: 0 0 10px 0; color: #666;"><strong>🌐 URL de Acesso:</strong></p>
              <p style="margin: 0; font-size: 16px;"><a href="${loginUrl}" style="color: #007bff; text-decoration: none; font-weight: bold;">${loginUrl}</a></p>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px;">
              <p style="margin: 0 0 10px 0; color: #666;"><strong>📧 Email:</strong></p>
              <p style="margin: 0; font-size: 16px; color: #333;">${profile.email}</p>
            </div>
            
            <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px;">
              <p style="margin: 0 0 10px 0; color: #666;"><strong>🔑 Senha:</strong></p>
              <p style="margin: 0; font-size: 18px; color: #333; font-weight: bold; background-color: #fff3cd; padding: 10px; border-radius: 5px; text-align: center;">${profile.cpf}</p>
            </div>
          </div>
          
          <div style="background-color: white; padding: 25px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); margin-bottom: 20px;">
            <h2 style="color: #333; font-size: 20px; margin-bottom: 15px;">📚 Produtos Adquiridos</h2>
            
            <div style="background-color: #d4edda; padding: 15px; border-radius: 5px;">
              ${productNames.map((productName, index) => `
                <p style="margin: ${index > 0 ? '15px' : '0'} 0; color: #333;">✅ ${productName}</p>
              `).join('')}
            </div>
          </div>
          
          <div style="background-color: #fff3cd; padding: 20px; border-radius: 10px; border-left: 4px solid #ffc107; margin-bottom: 20px;">
            <p style="margin: 0; color: #856404;"><strong>💡 Importante:</strong></p>
            <p style="margin: 5px 0 0 0; color: #856404;">Guarde seus dados de acesso em local seguro. Sua senha é o seu CPF sem formatação.</p>
          </div>
          
          <div style="text-align: center; margin-top: 30px;">
            <p style="color: #6c757d; font-size: 14px;">Precisa de ajuda? Estamos aqui para você!</p>
            <p style="margin: 10px 0;">
              <a href="https://web.whatsapp.com/send?phone=5537991202425" style="color: #25d366; text-decoration: none; font-weight: bold;">
                📱 Fale Conosco no WhatsApp
              </a>
            </p>
          </div>
          
          <div style="text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6;">
            <p style="color: #6c757d; font-size: 12px;">Enviado por SemEstress • ${new Date().toLocaleDateString('pt-BR')}</p>
          </div>
        </div>
      `;

      const resendResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: 'contato@medsemestress.com',
          to: profile.email,
          subject: emailSubject,
          html: emailBody,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.json();
        await supabase.from('logs').insert({
          level: 'error',
          context: 'webhook-email-error',
          message: 'Failed to send access email with purchase-confirmation template',
          metadata: { 
            userId, 
            orderId, 
            email: profile.email, 
            resendError: errorData 
          }
        });
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'webhook-email-sent',
          message: 'Access email sent successfully with purchase-confirmation template',
          metadata: { 
            userId, 
            orderId, 
            email: profile.email 
          }
        });
      }
    }

    // ETAPA 7: Meta CAPI Purchase Event (COM HASH CORRETO)
    const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID');
    const META_CAPI_ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN');

    if (META_PIXEL_ID && META_CAPI_ACCESS_TOKEN) {
      try {
        // Hash dos dados do usuário
        const hashedEmail = profile.email ? await sha256Hash(profile.email) : undefined;
        const hashedPhone = profile.whatsapp ? await sha256Hash(profile.whatsapp) : undefined;

        const capiPayload = {
          data: [
            {
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
                value: order.total_price.toFixed(2),
                currency: 'BRL',
                order_id: order.id,
              },
              event_id: `purchase_capi_${order.id}_${Date.now()}`,
            },
          ],
        };

        await supabase.from('logs').insert({
          level: 'info',
          context: 'webhook-meta-capi-payload',
          message: 'Sending Purchase event to Meta CAPI with hashed data',
          metadata: { 
            orderId, 
            userId,
            hasHashedEmail: !!hashedEmail,
            hasHashedPhone: !!hashedPhone,
            eventId: `purchase_capi_${order.id}_${Date.now()}`
          }
        });

        const metaResponse = await fetch(
          `https://graph.facebook.com/v19.0/${META_PIXEL_ID}/events?access_token=${META_CAPI_ACCESS_TOKEN}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(capiPayload),
          }
        );

        if (!metaResponse.ok) {
          const errorData = await metaResponse.json();
          await supabase.from('logs').insert({
            level: 'error',
            context: 'webhook-meta-capi-error',
            message: 'Failed to send Purchase event to Meta CAPI',
            metadata: { 
              orderId, 
              userId, 
              metaError: errorData,
              httpStatus: metaResponse.status
            }
          });
        } else {
          const responseData = await metaResponse.json();
          await supabase.from('logs').insert({
            level: 'info',
            context: 'webhook-meta-capi-success',
            message: 'Purchase event sent to Meta CAPI successfully',
            metadata: { 
              orderId, 
              userId,
              metaResponse: responseData
            }
          });
        }
      } catch (metaError: any) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'webhook-meta-capi-exception',
          message: 'Exception sending Purchase event to Meta CAPI',
          metadata: { 
            orderId, 
            userId, 
            error: metaError.message,
            errorStack: metaError.stack
          }
        });
      }
    }

    // ETAPA 8: Sucesso final
    await supabase.from('logs').insert({
      level: 'info',
      context: 'webhook-success',
      message: 'Webhook processed successfully - access granted with purchase-confirmation email',
      metadata: { 
        orderId,
        userId,
        asaasPaymentId,
        event: requestBody.event,
        productsGranted: orderedProductIds.length,
        emailTemplate: 'purchase-confirmation'
      }
    });

    return new Response(JSON.stringify({ 
      message: 'Webhook processed successfully.',
      orderId,
      userId,
      accessGranted: true,
      emailTemplate: 'purchase-confirmation'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'webhook-unhandled-error',
      message: `Unhandled error in webhook: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        asaasPaymentId,
        orderId,
        userId,
        event: requestBody?.event
      }
    });
    
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função auxiliar para buscar nomes dos produtos
async function getProductNames(productIds: string[], supabase: any): Promise<string[]> {
  try {
    const { data: products } = await supabase
      .from('products')
      .select('name')
      .in('id', productIds);
    
    if (products && products.length > 0) {
      return products.map(p => p.name);
    }
  } catch (error) {
    console.error('Error fetching product names:', error);
    return ['Produto não identificado'];
  }
}
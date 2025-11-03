import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { Resend } from 'https://esm.sh/resend@3.1.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para gerar senha padrão baseada no CPF
function generateDefaultPassword(cpf: string): string {
  const cleanCpf = cpf.replace(/[^0-9]/g, '');
  const cpfPrefix = cleanCpf.substring(0, 3);
  return `Sem@${cpfPrefix}`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Inicializar Supabase client
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    // Buscar a chave da API Resend dos secrets do Supabase
    const { data: secretData, error: secretError } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'RESEND_API_KEY')
      .single();

    if (secretError || !secretData) {
      console.error('Failed to retrieve Resend API key:', secretError);
      return new Response(JSON.stringify({ error: 'Resend API key not found' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Inicializar Resend com a chave recuperada
    const resend = new Resend(secretData.value);

    // Resto do código de processamento do webhook...
    const payload = await req.json();
    
    // Verificações e processamentos anteriores...
    
    // Exemplo de envio de e-mail usando Resend
    if (profile.email && profile.cpf) {
      const defaultPassword = generateDefaultPassword(profile.cpf);
      
      const appUrl = Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.vercel.app') || 'YOUR_APP_URL';
      const loginUrl = `${appUrl}/login`;
      
      try {
        const { data, error } = await resend.emails.send({
          from: 'SemEstress <onboarding@resend.dev>',
          to: profile.email,
          subject: "Seu acesso foi liberado!",
          html: `
            <h1>Acesso Liberado!</h1>
            <p>Parabéns! Seu pagamento foi confirmado.</p>
            <p>Seus dados de acesso:</p>
            <ul>
              <li>Login: ${loginUrl}</li>
              <li>Email: ${profile.email}</li>
              <li>Senha: ${defaultPassword}</li>
            </ul>
          `
        });

        if (error) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'asaas-webhook',
            message: 'Error sending access liberation email via Resend',
            metadata: { userId, orderId, asaasPaymentId, email: profile.email, error }
          });
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'asaas-webhook',
            message: `Access liberation email sent to ${profile.email}`,
            metadata: { userId, orderId, asaasPaymentId, email: profile.email }
          });
        }
      } catch (emailError: any) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'asaas-webhook',
          message: `Error sending email: ${emailError.message}`,
          metadata: { userId, orderId, asaasPaymentId, email: profile.email }
        });
      }
    }

    // Resto do código do webhook...

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'asaas-webhook',
      message: `Unhandled error: ${error.message}`,
      metadata: { errorStack: error.stack }
    });

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
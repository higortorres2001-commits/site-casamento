import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

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
    const { name, email, cpf, whatsapp } = await req.json();

    if (!name || !email || !cpf || !whatsapp) {
      return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limpar dados
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanPhone = whatsapp.replace(/\D/g, '');

    // Criar payload no formato correto
    const asaasPayload = {
      customer: {
        name,
        email,
        cpfCnpj: cleanCpf,
        phone: cleanPhone,
      },
      value: 10.00,
      description: "Teste de formato",
      dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      billingType: "PIX",
    };

    // Registrar o payload para verificação
    await supabase.from('logs').insert({
      level: 'info',
      context: 'test-customer-format',
      message: 'Teste de formato do objeto customer',
      metadata: {
        payload: asaasPayload,
        customerObject: asaasPayload.customer,
        rawData: { name, email, cpf, whatsapp }
      }
    });

    // Não fazer a chamada real para a API, apenas retornar o formato
    return new Response(JSON.stringify({
      success: true,
      message: 'Formato do objeto customer verificado',
      payload: asaasPayload,
      customerObject: asaasPayload.customer
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
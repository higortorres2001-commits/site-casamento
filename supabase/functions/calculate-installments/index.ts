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
    const { totalPrice } = await req.json();

    if (!totalPrice || totalPrice <= 0) {
      return new Response(
        JSON.stringify({ error: 'Preço total inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'calculate-installments',
        message: 'ASAAS_API_KEY ou ASAAS_API_URL não configurados',
        metadata: { totalPrice }
      });
      return new Response(
        JSON.stringify({ error: 'Configuração do gateway de pagamento ausente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Chamar API do Asaas para simular parcelas
    const asaasUrl = `${ASAAS_BASE_URL}/payments/simulate`;
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    const asaasPayload = {
      billingType: 'CREDIT_CARD',
      value: parseFloat(totalPrice.toFixed(2)),
      installmentCount: 12, // Simular até 12 parcelas
    };

    const asaasResponse = await fetch(asaasUrl, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(asaasPayload),
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Erro na API do Asaas:', errorData);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'calculate-installments',
        message: 'Erro ao consultar API do Asaas',
        metadata: { totalPrice, asaasError: errorData, statusCode: asaasResponse.status }
      });
      return new Response(
        JSON.stringify({ error: 'Erro ao calcular parcelas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const asaasData = await asaasResponse.json();

    // Formatar resposta para o frontend
    const installments = asaasData.installments || [];

    await supabase.from('logs').insert({
      level: 'info',
      context: 'calculate-installments',
      message: 'Parcelas calculadas com sucesso',
      metadata: { totalPrice, installmentCount: installments.length }
    });

    return new Response(
      JSON.stringify({ installments }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Erro na edge function:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'calculate-installments',
      message: `Erro não tratado: ${error.message}`,
      metadata: { errorStack: error.stack }
    });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
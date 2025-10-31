import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função de fallback para calcular parcelas manualmente
function calculateInstallmentsFallback(totalPrice: number) {
  const installments = [];
  
  // Taxas de juros por parcela (ajuste conforme necessário)
  const interestRates: Record<number, number> = {
    1: 0,      // À vista sem juros
    2: 2.99,   // 2x com 2.99% de juros
    3: 3.99,
    4: 4.99,
    5: 5.99,
    6: 6.99,
    7: 7.99,
    8: 8.99,
    9: 9.99,
    10: 10.99,
    11: 11.99,
    12: 12.99,
  };

  for (let i = 1; i <= 12; i++) {
    const interestPercentage = interestRates[i] || 0;
    const totalWithInterest = totalPrice * (1 + interestPercentage / 100);
    const installmentValue = totalWithInterest / i;

    installments.push({
      installmentNumber: i,
      installmentValue: parseFloat(installmentValue.toFixed(2)),
      totalValue: parseFloat(totalWithInterest.toFixed(2)),
      interestPercentage: interestPercentage,
    });
  }

  return installments;
}

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
    console.log('calculate-installments - Received totalPrice:', totalPrice);

    if (!totalPrice || totalPrice <= 0) {
      console.error('calculate-installments - Invalid totalPrice:', totalPrice);
      return new Response(
        JSON.stringify({ error: 'Preço total inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Por enquanto, vamos usar sempre o fallback até configurarmos corretamente a API do Asaas
    console.log('calculate-installments - Using fallback calculation');
    const installments = calculateInstallmentsFallback(totalPrice);

    console.log('calculate-installments - Calculated installments:', JSON.stringify(installments));

    await supabase.from('logs').insert({
      level: 'info',
      context: 'calculate-installments',
      message: 'Parcelas calculadas com sucesso (fallback)',
      metadata: { totalPrice, installmentCount: installments.length }
    });

    return new Response(
      JSON.stringify({ installments }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('calculate-installments - Unhandled error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'calculate-installments',
      message: `Erro não tratado: ${error.message}`,
      metadata: { errorStack: error.stack }
    });
    
    // Mesmo em caso de erro, retornar parcelas usando fallback
    try {
      const { totalPrice } = await req.json();
      if (totalPrice && totalPrice > 0) {
        const installments = calculateInstallmentsFallback(totalPrice);
        return new Response(
          JSON.stringify({ installments }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    } catch {}
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
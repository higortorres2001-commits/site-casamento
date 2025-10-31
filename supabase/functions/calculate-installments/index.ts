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
    const body = await req.json().catch(() => ({}));
    const value = typeof body?.value === 'number' ? body.value : Number(body?.value);

    if (!value || isNaN(value) || value <= 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'calculate-installments',
        message: 'Invalid or missing value for installments.',
        metadata: { received: body }
      });
      return new Response(JSON.stringify({ error: 'Invalid value.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'calculate-installments',
        message: 'ASAAS_API_KEY or ASAAS_API_URL not set.',
      });
      return new Response(JSON.stringify({ error: 'Asaas not configured.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `${ASAAS_BASE_URL}/installments?value=${encodeURIComponent(value.toFixed(2))}`;
    const asaasResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY,
      },
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json().catch(() => ({}));
      await supabase.from('logs').insert({
        level: 'error',
        context: 'calculate-installments',
        message: 'Asaas installments API error.',
        metadata: { status: asaasResponse.status, errorData }
      });
      return new Response(JSON.stringify({ error: 'Failed to fetch installments.', details: errorData }), {
        status: asaasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await asaasResponse.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'calculate-installments',
      message: 'Installments fetched successfully.',
      metadata: { value, dataPreview: Array.isArray(data) ? data.slice(0, 1) : data }
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'calculate-installments',
      message: `Unhandled error: ${err.message}`,
      metadata: { stack: err.stack }
    });
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS OPTIONS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase client for logging purposes
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let requestBody: any;
  let paymentId: string | undefined;

  try {
    requestBody = await req.json();
    paymentId = requestBody.payment_id;

    if (!paymentId) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'Missing payment_id in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing payment_id.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');

    if (!ASAAS_API_KEY || !ASAAS_BASE_URL) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'ASAAS_API_KEY or ASAAS_API_URL not set in Supabase secrets.',
        metadata: { paymentId }
      });
      return new Response(JSON.stringify({ error: 'ASAAS_API_KEY or ASAAS_API_URL not set.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasPaymentsUrl = `${ASAAS_BASE_URL}/payments/${paymentId}`;
    const asaasHeaders = {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    };

    const asaasResponse = await fetch(asaasPaymentsUrl, {
      method: 'GET',
      headers: asaasHeaders,
    });

    if (!asaasResponse.ok) {
      const errorData = await asaasResponse.json();
      console.error('Asaas API error checking payment status:', errorData);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'check-payment-status',
        message: 'Failed to check payment status with Asaas.',
        metadata: { paymentId, asaasError: errorData, statusCode: asaasResponse.status }
      });
      return new Response(JSON.stringify({ error: 'Failed to check payment status with Asaas.', details: errorData }), {
        status: asaasResponse.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const asaasData = await asaasResponse.json();
    const paymentStatus = asaasData.status;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'check-payment-status',
      message: `Payment status checked for ${paymentId}: ${paymentStatus}`,
      metadata: { paymentId, status: paymentStatus }
    });

    return new Response(JSON.stringify({ status: paymentStatus }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'check-payment-status',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        paymentId,
        requestBody,
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
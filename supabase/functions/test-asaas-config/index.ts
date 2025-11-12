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
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY');
    const ASAAS_BASE_URL = Deno.env.get('ASAAS_API_URL');
    const META_PIXEL_ID = Deno.env.get('META_PIXEL_ID');
    const META_CAPI_ACCESS_TOKEN = Deno.env.get('META_CAPI_ACCESS_TOKEN');
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const config = {
      hasAsaasApiKey: !!ASAAS_API_KEY,
      hasAsaasBaseUrl: !!ASAAS_BASE_URL,
      hasMetaPixelId: !!META_PIXEL_ID,
      hasMetaCapiToken: !!META_CAPI_ACCESS_TOKEN,
      hasResendApiKey: !!RESEND_API_KEY,
      asaasBaseUrl: ASAAS_BASE_URL || 'NOT_SET',
      timestamp: new Date().toISOString()
    };

    await supabase.from('logs').insert({
      level: 'info',
      context: 'test-asaas-config',
      message: 'Configuration check completed',
      metadata: config
    });

    // Teste básico da API do Asaas se as credenciais estiverem disponíveis
    if (ASAAS_API_KEY && ASAAS_BASE_URL) {
      try {
        const testResponse = await fetch(`${ASAAS_BASE_URL}/customers?limit=1`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'access_token': ASAAS_API_KEY,
          }
        });

        config.asaasApiTest = {
          status: testResponse.status,
          statusText: testResponse.statusText,
          ok: testResponse.ok
        };

        if (!testResponse.ok) {
          const errorData = await testResponse.json();
          config.asaasApiError = errorData;
        }
      } catch (asaasError: any) {
        config.asaasApiError = {
          message: asaasError.message,
          name: asaasError.name
        };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      config,
      message: 'Configuration check completed'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'test-asaas-config-error',
      message: `Configuration test failed: ${error.message}`,
      metadata: {
        errorMessage: error.message,
        errorStack: error.stack
      }
    });

    return new Response(JSON.stringify({ 
      error: error.message,
      success: false
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
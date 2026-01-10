import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';

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

  try {
    const { email, token } = await req.json();

    if (!email || !token) {
      return new Response(JSON.stringify({ error: 'Email and token are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'checkout-otp-verify',
      message: 'Verifying OTP for checkout',
      metadata: { email: cleanEmail }
    });

    // Verificar OTP usando o cliente anônimo
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { data, error } = await anonSupabase.auth.verifyOtp({
      email: cleanEmail,
      token: token,
      type: 'email'
    });

    if (error) {
      console.error('OTP verification error:', error);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'checkout-otp-verify',
        message: 'OTP verification failed',
        metadata: {
          email: cleanEmail,
          error: error.message,
          errorType: error.name
        }
      });
      return new Response(JSON.stringify({ error: 'Código inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!data.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'checkout-otp-verify',
        message: 'OTP verified but no user returned',
        metadata: { email: cleanEmail }
      });
      return new Response(JSON.stringify({ error: 'Erro na verificação' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar dados do perfil do usuário
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('name, cpf, whatsapp')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'checkout-otp-verify',
        message: 'Failed to fetch user profile after OTP verification',
        metadata: {
          email: cleanEmail,
          userId: data.user.id,
          error: profileError?.message
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao carregar dados do usuário' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'checkout-otp-verify',
      message: 'OTP verified successfully for checkout',
      metadata: {
        email: cleanEmail,
        userId: data.user.id
      }
    });

    return new Response(JSON.stringify({
      success: true,
      userData: {
        name: profile.name || "",
        cpf: profile.cpf || "",
        whatsapp: profile.whatsapp || ""
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'checkout-otp-verify',
      message: 'Unexpected error verifying OTP',
      metadata: {
        error: error.message,
        errorStack: error.stack
      }
    });
    return new Response(JSON.stringify({ error: 'Erro inesperado: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
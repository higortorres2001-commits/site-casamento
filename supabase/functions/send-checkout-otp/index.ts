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
    const { email } = await req.json();

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'checkout-otp-send',
      message: 'Sending OTP for checkout verification',
      metadata: { email: cleanEmail }
    });

    // Verificar se o usuário existe
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Error listing users:', authError);
      return new Response(JSON.stringify({ error: 'Failed to check user existence' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === cleanEmail);

    if (!existingUser) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'checkout-otp-send',
        message: 'OTP requested for non-existent user',
        metadata: { email: cleanEmail }
      });
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Enviar OTP usando o cliente anônimo (não o service role)
    const anonSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );

    const { error: otpError } = await anonSupabase.auth.signInWithOtp({
      email: cleanEmail
    });

    if (otpError) {
      console.error('Error sending OTP:', otpError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'checkout-otp-send',
        message: 'Failed to send OTP',
        metadata: {
          email: cleanEmail,
          error: otpError.message,
          errorType: otpError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao enviar código: ' + otpError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'checkout-otp-send',
      message: 'OTP sent successfully for checkout',
      metadata: { email: cleanEmail }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Código enviado com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'checkout-otp-send',
      message: 'Unexpected error sending OTP',
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
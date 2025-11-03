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
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user's CPF from profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('cpf, email')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.cpf) {
      console.error('Error fetching profile:', profileError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'reset-user-password',
        message: 'Profile or CPF not found',
        metadata: { userId, error: profileError?.message }
      });
      return new Response(JSON.stringify({ error: 'CPF do usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const cleanCpf = profile.cpf.replace(/[^\d]+/g, '');

    // Update user password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: cleanCpf }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'reset-user-password',
        message: 'Failed to update password',
        metadata: { userId, error: updateError.message }
      });
      return new Response(JSON.stringify({ error: 'Erro ao redefinir senha: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update profile flags
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        has_changed_password: false,
        primeiro_acesso: true
      })
      .eq('id', userId);

    if (profileUpdateError) {
      console.error('Error updating profile flags:', profileUpdateError);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'reset-user-password',
      message: 'Password reset successfully',
      metadata: { userId, email: profile.email }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Senha redefinida para o CPF do usuário'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'reset-user-password',
      message: 'Unexpected error',
      metadata: { error: error?.message, stack: error?.stack }
    });
    return new Response(JSON.stringify({ error: 'Erro inesperado: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
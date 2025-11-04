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
    const { email, newPassword } = await req.json();

    if (!email || !newPassword) {
      return new Response(JSON.stringify({ error: 'Email e nova senha são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Encontrar o usuário pelo email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar usuários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const targetUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (!targetUser) {
      return new Response(JSON.stringify({ error: 'Usuário não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found user: ${targetUser.id} with email: ${targetUser.email}`);

    // 2. Forçar atualização da senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'force-update-password',
        message: 'Failed to force update password',
        metadata: { 
          userId: targetUser.id, 
          email, 
          error: updateError.message 
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao atualizar senha: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Atualizar perfil para indicar que a senha foi alterada
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ 
        has_changed_password: false, // Força a troca no primeiro login
        primeiro_acesso: true 
      })
      .eq('id', targetUser.id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'force-update-password',
        message: 'Failed to update profile flags',
        metadata: { 
          userId: targetUser.id, 
          error: profileError.message 
        }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'force-update-password',
      message: 'Password force updated successfully',
      metadata: { 
        userId: targetUser.id, 
        email, 
        newPasswordLength: newPassword.length 
      }
    });

    console.log(`Password successfully updated for user: ${targetUser.id}`);

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Senha atualizada com sucesso!',
      userId: targetUser.id
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'force-update-password',
      message: 'Unexpected error',
      metadata: { 
        errorMessage: error.message, 
        errorStack: error.stack 
      }
    });
    return new Response(JSON.stringify({ error: 'Erro inesperado: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
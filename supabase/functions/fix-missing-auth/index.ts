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
    const { profileId } = await req.json();

    if (!profileId) {
      return new Response(JSON.stringify({ error: 'profileId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fixing missing auth for profile: ${profileId}`);

    // 1. Buscar profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', profileId)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Verificar se já existe auth
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar usuários existentes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingAuthUser = authUsers.users.find(u => u.id === profileId);
    
    if (existingAuthUser) {
      console.log('Auth user already exists for this profile');
      return new Response(JSON.stringify({ 
        error: 'Usuário auth já existe para este profile',
        authUser: existingAuthUser
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Criar usuário auth usando CPF como senha
    const cleanCpf = profile.cpf?.replace(/[^\d]+/g, '');
    
    if (!cleanCpf || cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido ou ausente no profile' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Creating auth user with email: ${profile.email}, password: ${cleanCpf}`);

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: profile.email,
      password: cleanCpf,
      email_confirm: true,
      user_metadata: { 
        name: profile.name,
        cpf: cleanCpf,
        whatsapp: profile.whatsapp
      },
    });

    if (createError || !newUser?.user) {
      console.error('Error creating auth user:', createError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'fix-missing-auth',
        message: 'Failed to create auth user',
        metadata: { 
          profileId, 
          email: profile.email,
          error: createError?.message 
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao criar usuário auth: ' + (createError?.message || 'Unknown error') }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Auth user created successfully: ${newUser.user.id}`);

    // 4. Atualizar profile se necessário
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        has_changed_password: false,
        primeiro_acesso: true 
      })
      .eq('id', profileId);

    if (updateError) {
      console.error('Error updating profile:', updateError);
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'fix-missing-auth',
      message: 'Auth user created successfully',
      metadata: { 
        profileId, 
        email: profile.email,
        authUserId: newUser.user.id 
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Usuário auth criado com sucesso!',
      authUser: newUser.user,
      profile: profile
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'fix-missing-auth',
      message: `Unhandled error: ${error.message}`,
      metadata: { 
        errorStack: error.stack 
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
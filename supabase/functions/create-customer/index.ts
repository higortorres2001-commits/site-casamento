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
    const payload = await req.json();
    const { email, name, cpf, whatsapp } = payload;

    if (!email || !name || !cpf || !whatsapp) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sanitizedCpf = cpf.replace(/[^\d]+/g, '');
    const defaultPassword = `Sem123${sanitizedCpf.substring(0, 3)}`;

    // Primeiro, verificar se o usuário já existe no Auth
    const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers({ email });
    
    let userId: string;

    if (existingUsers && existingUsers.users.length > 0) {
      // Usuário já existe no Auth
      userId = existingUsers.users[0].id;
      
      // Tentar atualizar o perfil do usuário
      const { error: upsertError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          name, 
          cpf: sanitizedCpf, 
          email, 
          whatsapp,
          primeiro_acesso: true,
          has_changed_password: false
        }, {
          onConflict: 'id'
        });

      if (upsertError) {
        console.error('Error upserting profile:', upsertError);
        return new Response(JSON.stringify({ error: 'Failed to update user profile.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        id: userId, 
        message: 'Usuário atualizado com sucesso.' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Se o usuário não existe, criar novo usuário
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: defaultPassword,
      email_confirm: true,
      user_metadata: { 
        name, 
        cpf: sanitizedCpf, 
        whatsapp 
      },
    });

    if (createError || !newUser?.user) {
      return new Response(JSON.stringify({ error: 'Failed to create user account.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userId = newUser.user.id;

    // Criar perfil
    const { error: insertProfileError } = await supabase
      .from('profiles')
      .insert({ 
        id: userId, 
        name, 
        cpf: sanitizedCpf, 
        email, 
        whatsapp,
        primeiro_acesso: true,
        has_changed_password: false
      });

    if (insertProfileError) {
      return new Response(JSON.stringify({ error: 'Failed to create profile.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      id: userId, 
      message: 'Usuário criado com sucesso.' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
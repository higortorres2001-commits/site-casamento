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
    const { email, name, cpf, whatsapp } = await req.json();

    // Validate required fields
    if (!email || !name || !cpf || !whatsapp) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Missing required fields',
        metadata: { email, name, cpf: cpf ? 'provided' : 'missing', whatsapp: whatsapp ? 'provided' : 'missing' }
      });
      return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean CPF
    const cleanCpf = cpf.replace(/[^\d]+/g, '');
    
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user exists
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to list users',
        metadata: { error: listError.message }
      });
      return new Response(JSON.stringify({ error: 'Erro ao verificar usuários existentes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    
    if (existingUser) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-customer',
        message: 'User already exists',
        metadata: { email, existingUserId: existingUser.id }
      });
      return new Response(JSON.stringify({ error: 'Usuário com este email já existe' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: cleanCpf,
      email_confirm: true,
      user_metadata: { name, cpf: cleanCpf, whatsapp }
    });

    if (createError || !newUser?.user) {
      console.error('Error creating user:', createError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to create user',
        metadata: { email, error: createError?.message }
      });
      return new Response(JSON.stringify({ error: 'Erro ao criar usuário: ' + (createError?.message || 'Unknown error') }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name,
        cpf: cleanCpf,
        email,
        whatsapp,
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false
      });

    if (profileError) {
      console.error('Error creating profile:', profileError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to create profile',
        metadata: { userId, error: profileError.message }
      });
      // Don't fail the request, profile can be created later
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer',
      message: 'User created successfully',
      metadata: { userId, email, cpfLength: cleanCpf.length }
    });

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      email,
      message: 'Usuário criado com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-customer',
      message: 'Unexpected error',
      metadata: { error: error?.message, stack: error?.stack }
    });
    return new Response(JSON.stringify({ error: 'Erro inesperado: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
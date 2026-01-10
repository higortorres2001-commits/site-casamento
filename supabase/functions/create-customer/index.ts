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
    const { email, name, cpf, whatsapp } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-start',
      message: 'Manual customer creation started',
      metadata: {
        email: email.toLowerCase().trim(),
        name,
        cpf: cpf ? 'PROVIDED' : 'MISSING',
        whatsapp: whatsapp ? 'PROVIDED' : 'MISSING'
      }
    });

    // Validate required fields
    if (!email || !name || !cpf || !whatsapp) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-validation',
        message: 'Missing required fields',
        metadata: {
          hasEmail: !!email,
          hasName: !!name,
          hasCpf: !!cpf,
          hasWhatsapp: !!whatsapp
        }
      });
      return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean and validate CPF
    const cleanCpf = cpf.replace(/[^\d]+/g, '');

    if (cleanCpf.length !== 11) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-validation',
        message: 'Invalid CPF format',
        metadata: {
          originalCpf: cpf,
          cleanCpf,
          cleanCpfLength: cleanCpf.length
        }
      });
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 1: Verificar duplicidade de email
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-email-check',
      message: 'Checking for existing email',
      metadata: { email: email.toLowerCase().trim() }
    });

    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-list-error',
        message: 'Failed to list users for email check',
        metadata: {
          error: listError.message,
          errorType: listError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao verificar usuários existentes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());

    if (existingUser) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-customer-email-duplicate',
        message: 'Email already exists in auth system',
        metadata: {
          requestedEmail: email.toLowerCase().trim(),
          existingUserId: existingUser.id,
          existingUserEmail: existingUser.email,
          existingUserCreated: existingUser.created_at
        }
      });
      return new Response(JSON.stringify({ error: 'Usuário com este email já existe' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 2: Verificar duplicidade de CPF nos perfis
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-cpf-check',
      message: 'Checking for existing CPF in profiles',
      metadata: { cleanCpf }
    });

    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, email, name, created_at')
      .eq('cpf', cleanCpf)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') { // PGRST116 = no rows returned
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-cpf-check-error',
        message: 'Error checking CPF in profiles',
        metadata: {
          cleanCpf,
          error: profileCheckError.message,
          errorCode: profileCheckError.code
        }
      });
    }

    if (existingProfile) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-customer-cpf-duplicate',
        message: 'CPF already exists in profiles table',
        metadata: {
          cleanCpf,
          existingProfileId: existingProfile.id,
          existingProfileEmail: existingProfile.email,
          existingProfileName: existingProfile.name
        }
      });
      return new Response(JSON.stringify({ error: 'CPF já cadastrado no sistema' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ETAPA 3: Criar usuário no auth
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-auth-creation',
      message: 'Creating user in auth system',
      metadata: {
        email: email.toLowerCase().trim(),
        name,
        cleanCpfLength: cleanCpf.length
      }
    });

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: cleanCpf,
      email_confirm: true,
      user_metadata: {
        name,
        cpf: cleanCpf,
        whatsapp: whatsapp.replace(/\D/g, ''),
        created_via: 'admin_manual'
      },
    });

    if (createError || !newUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-auth-error',
        message: 'Failed to create user in auth system',
        metadata: {
          email: email.toLowerCase().trim(),
          name,
          cleanCpfLength: cleanCpf.length,
          error: createError?.message,
          errorType: createError?.name,
          errorCode: createError?.code
        }
      });
      return new Response(JSON.stringify({ error: 'Erro ao criar usuário: ' + (createError?.message || 'Unknown error') }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-auth-success',
      message: 'User created successfully in auth system',
      metadata: {
        userId,
        email: email.toLowerCase().trim(),
        name
      }
    });

    // ETAPA 4: Criar perfil
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-profile-creation',
      message: 'Creating user profile',
      metadata: { userId }
    });

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: userId,
        name,
        cpf: cleanCpf,
        email: email.toLowerCase().trim(),
        whatsapp: whatsapp.replace(/\D/g, ''),
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer-profile-error',
        message: 'Failed to create user profile',
        metadata: {
          userId,
          error: profileError.message,
          errorType: profileError.name,
          errorCode: profileError.code
        }
      });
      // Não falhar completamente - o usuário foi criado no auth
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'create-customer-profile-success',
        message: 'User profile created successfully',
        metadata: { userId }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer-success',
      message: 'Manual customer creation completed successfully',
      metadata: {
        userId,
        email: email.toLowerCase().trim(),
        name,
        cleanCpfLength: cleanCpf.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      userId,
      email: email.toLowerCase().trim(),
      message: 'Usuário criado com sucesso'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-customer-unhandled-error',
      message: 'Unhandled error in manual customer creation',
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
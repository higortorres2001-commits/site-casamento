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
    const { name, email, cpf, whatsapp, password, userMetadata } = await req.json();
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-start',
      message: 'User creation process started',
      metadata: { 
        email: email.toLowerCase().trim(),
        name,
        cpfLength: cpf?.length || 0,
        whatsappLength: whatsapp?.length || 0,
        hasPassword: !!password,
        hasUserMetadata: !!userMetadata,
        createdVia: userMetadata?.created_via || 'unknown'
      }
    });

    // Validate required fields
    if (!name || !email || !cpf || !whatsapp) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-validation',
        message: 'Missing required fields',
        metadata: { 
          hasName: !!name,
          hasEmail: !!email,
          hasCpf: !!cpf,
          hasWhatsapp: !!whatsapp
        }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Clean and validate CPF
    const cleanCpf = cpf.replace(/[^0-9]/g, '');
    
    if (cleanCpf.length !== 11) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-validation',
        message: 'Invalid CPF format',
        metadata: { 
          originalCpf: cpf,
          cleanCpf,
          cleanCpfLength: cleanCpf.length
        }
      });
      return new Response(JSON.stringify({ error: 'Invalid CPF format' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user already exists
    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-duplicate-check',
      message: 'Checking for existing user',
      metadata: { 
        email: email.toLowerCase().trim(),
        cleanCpf
      }
    });

    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-list-error',
        message: 'Failed to check for existing user',
        metadata: { 
          email: email.toLowerCase().trim(),
          error: listError.message,
          errorType: listError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to check for existing user' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase().trim());
    
    if (existingUser) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'handle-user-creation-duplicate',
        message: 'User already exists in auth system',
        metadata: { 
          requestedEmail: email.toLowerCase().trim(),
          existingUserId: existingUser.id,
          existingUserEmail: existingUser.email,
          existingUserCreated: existingUser.created_at
        }
      });
      return new Response(JSON.stringify({ 
        error: 'User with this email already exists',
        userId: existingUser.id,
        exists: true
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for duplicate CPF in profiles
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, email, name, created_at')
      .eq('cpf', cleanCpf)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-cpf-check-error',
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
        context: 'handle-user-creation-cpf-duplicate',
        message: 'CPF already exists in profiles table',
        metadata: { 
          cleanCpf,
          existingProfileId: existingProfile.id,
          existingProfileEmail: existingProfile.email,
          existingProfileName: existingProfile.name
        }
      });
      return new Response(JSON.stringify({ 
        error: 'CPF already registered in system',
        profileId: existingProfile.id,
        exists: true
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user in auth system
    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-auth-start',
      message: 'Creating user in auth system',
      metadata: { 
        email: email.toLowerCase().trim(),
        name,
        cleanCpfLength: cleanCpf.length,
        passwordLength: password?.length || 0
      }
    });

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: password || cleanCpf,
      email_confirm: true,
      user_metadata: { 
        name, 
        cpf: cleanCpf, 
        whatsapp: whatsapp.replace(/\D/g, ''),
        ...userMetadata
      },
    });

    if (createError || !newUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-auth-error',
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
      return new Response(JSON.stringify({ 
        error: 'Failed to create user account',
        details: createError?.message 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const userId = newUser.user.id;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-auth-success',
      message: 'User created successfully in auth system',
      metadata: { 
        userId,
        email: email.toLowerCase().trim(),
        name
      }
    });
    
    // Create user profile
    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-profile-start',
      message: 'Creating user profile',
      metadata: { userId }
    });

    const { error: profileError, data: profileData } = await supabase
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
      })
      .select()
      .single();
    
    if (profileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'handle-user-creation-profile-error',
        message: 'Failed to create user profile',
        metadata: { 
          userId, 
          email: email.toLowerCase().trim(),
          error: profileError.message,
          errorType: profileError.name,
          errorCode: profileError.code
        }
      });
      // Don't fail completely - the user was created in auth
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'handle-user-creation-profile-success',
        message: 'User profile created successfully',
        metadata: { userId, profileId: profileData?.id }
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'handle-user-creation-success',
      message: 'User creation process completed successfully',
      metadata: { 
        userId, 
        email: email.toLowerCase().trim(),
        name,
        cleanCpfLength: cleanCpf.length,
        createdVia: userMetadata?.created_via || 'unknown'
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      email: email.toLowerCase().trim(),
      message: 'User created successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'handle-user-creation-unhandled-error',
      message: 'Unhandled error in user creation',
      metadata: { 
        error: error.message,
        errorStack: error.stack
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
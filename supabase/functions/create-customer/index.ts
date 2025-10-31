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

  // Service role client for admin operations
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let payload: any;

  try {
    payload = await req.json();
    const { email, name, cpf, whatsapp } = payload;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer',
      message: 'Attempting to create customer.',
      metadata: { payload }
    });

    if (!email || !name || !cpf || !whatsapp) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Missing required fields (email, name, cpf, whatsapp) in request.',
        metadata: { payload }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    // 1. Check if user already exists in auth.users
    const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ email });
    if (listError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Error listing users.',
        metadata: { email, listError: listError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to check existing user.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (existing && existing.users && existing.users.length > 0) {
      const userId = existing.users[0].id;
      
      // User exists in auth.users, now check if profile exists
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (profileError && profileError.code === 'PGRST116') { // PGRST116: No rows found
        // Profile does not exist, create it manually
        const { error: insertProfileError } = await supabase
          .from('profiles')
          .insert({ 
            id: userId, 
            email, 
            name, 
            cpf: cleanCpf, 
            whatsapp: cleanWhatsapp 
          });

        if (insertProfileError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'create-customer',
            message: 'User exists, but failed to create missing profile.',
            metadata: { userId, email, error: insertProfileError.message }
          });
          return new Response(JSON.stringify({ error: 'User exists, but failed to create missing profile.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        await supabase.from('logs').insert({
          level: 'info',
          context: 'create-customer',
          message: 'User existed, missing profile created successfully.',
          metadata: { userId, email }
        });
        return new Response(JSON.stringify({ id: userId, email, name, message: 'Profile created for existing user.' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else if (profileError) {
        // Other profile error
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-customer',
          message: 'Error checking existing profile.',
          metadata: { userId, email, error: profileError.message }
        });
        return new Response(JSON.stringify({ error: 'Error checking existing profile.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      // User and Profile exist, return success
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-customer',
        message: 'User and profile already exist.',
        metadata: { email, userId }
      });
      return new Response(JSON.stringify({ id: userId, email, name, message: 'User already exists.' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. User does not exist, proceed with creation
    const finalPassword = cleanCpf; // Use clean CPF as password

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: finalPassword,
      email_confirm: true,
      user_metadata: { name, cpf: cleanCpf, whatsapp: cleanWhatsapp }, // Pass clean data to metadata
    });

    if (createError || !newUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to create new user.',
        metadata: { email, error: createError?.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to create user.', details: createError?.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer',
      message: 'New user created successfully. Profile creation handled by trigger.',
      metadata: { userId, email }
    });

    return new Response(JSON.stringify({ id: userId, email, name }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Create customer edge function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-customer',
      message: 'Unhandled error in edge function.',
      metadata: { error: error?.message ?? 'Unknown error', stack: error?.stack }
    });
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
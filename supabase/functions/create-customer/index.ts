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

  try {
    const payload = await req.json();
    const { email, name, cpf, whatsapp } = payload;

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

    // Check if user already exists
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
      return new Response(JSON.stringify({ error: 'User already exists.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create user (password derived from CPF if not provided)
    const password = cpf?.toString() || 'TempPass123';
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, cpf, whatsapp },
    });

    if (createError || !newUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to create new user.',
        metadata: { email, error: createError?.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to create user.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = newUser.user.id;

    // Seed profile
    const { error: insertProfileError } = await supabase
      .from('profiles')
      .insert({ id: userId, name, cpf, email, whatsapp });

    if (insertProfileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to insert profile for new user.',
        metadata: { userId, error: insertProfileError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to seed user profile.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

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
      metadata: { error: error?.message, stack: error?.stack }
    });
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
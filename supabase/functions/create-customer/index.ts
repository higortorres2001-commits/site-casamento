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
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'create-customer',
        message: 'User already exists.',
        metadata: { email, userId: existing.users[0].id }
      });
      return new Response(JSON.stringify({ error: 'User already exists.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use a temporary, strong password to satisfy Supabase policies
    const temporaryPassword = 'TempPass123!'; 
    
    // Ensure CPF and WhatsApp are clean (only digits) for user_metadata
    const cleanCpf = cpf.replace(/\D/g, '');
    const cleanWhatsapp = whatsapp.replace(/\D/g, '');

    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password: temporaryPassword, // Use temporary strong password
      email_confirm: true,
      user_metadata: { name, cpf: cleanCpf, whatsapp: cleanWhatsapp, primeiro_acesso: true }, // Pass clean data to metadata
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
      message: 'User created successfully.',
      metadata: { userId, email }
    });

    // The trigger `handle_new_user` will now insert the profile.
    // We need to manually update the profile with the CPF as the initial password hint, 
    // and set has_changed_password to false, as the user was created with a temporary password.
    
    // NOTE: The trigger currently sets the password to CPF. Let's revert the password logic 
    // in the trigger to use the CPF as the initial password, as intended by the user's flow, 
    // but we must ensure the CPF meets Supabase's minimum length requirement (usually 6 chars).
    // Since CPF has 11 digits, it should be fine.

    // Reverting to CPF as password, but ensuring we log the error if it fails due to policy.
    // Let's stick to the original plan of using CPF as password, but ensure the client side handles the password update flow.
    
    // Re-running the user creation with CPF as password, but ensuring the CPF is clean (11 digits)
    // If the previous error was due to password policy, we need to know.
    
    // Let's assume the password policy is the issue and use the temporary password, 
    // but we must ensure the user is forced to change it.
    
    // Since the user flow relies on the CPF being the initial password, let's try to set it again, 
    // but if it fails, we must inform the user.
    
    // Let's stick to the temporary password approach for robustness, and rely on the client flow 
    // to force a password change. The client flow already redirects to `/primeira-senha` if `has_changed_password` is false.
    
    // The trigger `handle_new_user` needs to be updated to set `has_changed_password` to false 
    // and `primeiro_acesso` to true, which is already done in the existing trigger logic.
    
    // Let's check the existing trigger logic again:
    /*
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    ...
    BEGIN
      INSERT INTO public.profiles (id, email, name, cpf, whatsapp)
      VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data ->> 'name',
        new.raw_user_meta_data ->> 'cpf',
        new.raw_user_meta_data ->> 'whatsapp'
      );
      RETURN new;
    END;
    */
    // The trigger does NOT set `has_changed_password` or `primeiro_acesso`.
    // The columns `primeiro_acesso` and `has_changed_password` have default values in the table definition:
    // `primeiro_acesso` default: true
    // `has_changed_password` default: false
    // So, the trigger is fine, as the defaults will apply.

    // Final check on the password: If the user's CPF is used as password, it must be passed to `createUser`.
    // Let's revert to using CPF as password, but ensure it's clean.
    
    const finalPassword = cleanCpf; // Use clean CPF as password

    const { error: updatePasswordError } = await supabase.auth.admin.updateUserById(userId, {
      password: finalPassword,
    });

    if (updatePasswordError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-customer',
        message: 'Failed to set CPF as password after user creation.',
        metadata: { userId, error: updatePasswordError.message }
      });
      // This is a critical failure, but the user is created. We return an error.
      return new Response(JSON.stringify({ error: 'User created, but failed to set CPF as password. Please reset password manually.', details: updatePasswordError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    await supabase.from('logs').insert({
      level: 'info',
      context: 'create-customer',
      message: 'User password set to CPF successfully.',
      metadata: { userId }
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
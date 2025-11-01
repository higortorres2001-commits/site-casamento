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
  // Using the service role key grants admin privileges, including auth.admin methods.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  let requestBody: any;
  let userId: string | undefined;

  try {
    requestBody = await req.json();
    userId = requestBody.userId;
    const newPassword = requestBody.newPassword;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'reset-customer-password',
      message: 'Attempting password reset.',
      metadata: { userId, passwordLength: newPassword?.length, requestBody }
    });

    if (!userId || !newPassword) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'reset-customer-password',
        message: 'Missing userId or newPassword in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 1. Update user password in Supabase Auth (Admin API)
    // The client created with the service role key should expose auth.admin
    const { data: updateAuthData, error: updateAuthError } = await supabase.auth.admin.updateUser(
      userId,
      { password: newPassword }
    );

    if (updateAuthError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'reset-customer-password',
        message: 'Failed to update user password via Auth Admin API.',
        metadata: { userId, error: updateAuthError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to update password.', details: updateAuthError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Reset has_changed_password flag in profiles table to force change on next login
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ has_changed_password: false })
      .eq('id', userId);

    if (updateProfileError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'reset-customer-password',
        message: 'Failed to reset has_changed_password flag in profile.',
        metadata: { userId, error: updateProfileError.message }
      });
      // Continue, as the password was successfully changed in Auth
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'reset-customer-password',
      message: 'Customer password reset successfully.',
      metadata: { userId }
    });

    return new Response(JSON.stringify({ message: 'Password reset successfully.' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Reset password edge function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'reset-customer-password',
      message: 'Unhandled error in edge function.',
      metadata: { error: error?.message, stack: error?.stack, userId, requestBody }
    });
    return new Response(JSON.stringify({ error: error?.message ?? 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
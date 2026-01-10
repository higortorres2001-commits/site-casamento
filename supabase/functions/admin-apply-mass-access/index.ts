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

  let requestBody: any;
  let adminUserId: string | undefined;

  try {
    // 1. Get the current user (admin) from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    adminUserId = user.id;

    // 2. Verify if the current user is an admin
    const { data: adminProfile, error: adminProfileError } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', adminUserId)
      .single();

    if (adminProfileError || !adminProfile?.is_admin) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-apply-mass-access-unauthorized',
        message: 'Non-admin user attempted to apply mass access',
        metadata: {
          adminUserId,
          error: adminProfileError?.message,
          isAdmin: adminProfile?.is_admin
        }
      });

      return new Response(JSON.stringify({ error: 'Unauthorized: Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Parse request body
    requestBody = await req.json();
    const { productIds, customerIds } = requestBody;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return new Response(JSON.stringify({ error: 'productIds is required and must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!customerIds || !Array.isArray(customerIds) || customerIds.length === 0) {
      return new Response(JSON.stringify({ error: 'customerIds is required and must be a non-empty array' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-apply-mass-access-start',
      message: 'Admin started mass access application',
      metadata: {
        adminUserId,
        productIdsCount: productIds.length,
        customerIdsCount: customerIds.length
      }
    });

    // 4. Fetch current profiles for all customers
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, access, name, email')
      .in('id', customerIds);

    if (profilesError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-apply-mass-access-profiles-error',
        message: 'Failed to fetch user profiles',
        metadata: {
          adminUserId,
          customerIds,
          error: profilesError.message,
          errorType: profilesError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to fetch user profiles: ' + profilesError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!profiles || profiles.length === 0) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'admin-apply-mass-access-no-profiles',
        message: 'No profiles found for the provided customer IDs',
        metadata: {
          adminUserId,
          customerIds
        }
      });
      return new Response(JSON.stringify({ error: 'No profiles found for the provided customer IDs' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Prepare updates for each profile
    const updates = profiles.map(profile => {
      const currentAccess = Array.isArray(profile.access) ? profile.access : [];
      const newAccess = [...new Set([...currentAccess, ...productIds])];

      return {
        id: profile.id,
        access: newAccess,
        updated_at: new Date().toISOString()
      };
    });

    // 6. Update all profiles in a single operation
    const { error: updateError } = await supabase
      .from('profiles')
      .upsert(updates);

    if (updateError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-apply-mass-access-update-error',
        message: 'Failed to update user profiles with mass access',
        metadata: {
          adminUserId,
          updatesCount: updates.length,
          error: updateError.message,
          errorType: updateError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to update user profiles: ' + updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-apply-mass-access-success',
      message: 'Mass access applied successfully',
      metadata: {
        adminUserId,
        updatedProfilesCount: updates.length,
        productIdsCount: productIds.length,
        customerIdsCount: customerIds.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Access granted to ${updates.length} customer(s) for ${productIds.length} product(s)`,
      updatedCount: updates.length
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'admin-apply-mass-access-unhandled-error',
      message: `Unhandled error in admin-apply-mass-access: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        adminUserId,
        requestBody
      }
    });

    return new Response(JSON.stringify({ error: 'Unexpected error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
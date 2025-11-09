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

  let requestBody: any;
  let adminUserId: string | undefined;
  let userIdToDelete: string | undefined;

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
        context: 'admin-delete-user-unauthorized',
        message: 'Non-admin user attempted to delete user',
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
    const { userId: targetUserId } = requestBody;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userIdToDelete = targetUserId;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-delete-user-start',
      message: 'Admin started user deletion process',
      metadata: { 
        adminUserId,
        userIdToDelete
      }
    });

    // 4. Get user data to delete associated assets
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('id', userIdToDelete)
      .single();

    if (userError || !userData) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-delete-user-not-found',
        message: 'Target user not found',
        metadata: { 
          adminUserId,
          userIdToDelete,
          error: userError?.message
        }
      });
      
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Delete user's orders
    const { error: ordersError } = await supabase
      .from('orders')
      .delete()
      .eq('user_id', userIdToDelete);

    if (ordersError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-delete-user-orders-error',
        message: 'Failed to delete user orders',
        metadata: { 
          adminUserId,
          userIdToDelete,
          error: ordersError.message,
          errorType: ordersError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to delete user orders: ' + ordersError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 6. Delete user's profile
    const { error: profileError } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userIdToDelete);

    if (profileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-delete-user-profile-error',
        message: 'Failed to delete user profile',
        metadata: { 
          adminUserId,
          userIdToDelete,
          error: profileError.message,
          errorType: profileError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to delete user profile: ' + profileError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 7. Delete user from auth system
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userIdToDelete);

    if (authDeleteError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-delete-user-auth-error',
        message: 'Failed to delete user from auth system',
        metadata: { 
          adminUserId,
          userIdToDelete,
          error: authDeleteError.message,
          errorType: authDeleteError.name
        }
      });
      return new Response(JSON.stringify({ error: 'Failed to delete user from auth system: ' + authDeleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-delete-user-success',
      message: 'User deleted successfully',
      metadata: { 
        adminUserId,
        userIdToDelete,
        deletedUserData: {
          name: userData.name,
          email: userData.email
        }
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'User deleted successfully'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'admin-delete-user-unhandled-error',
      message: `Unhandled error in admin-delete-user: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        adminUserId,
        userIdToDelete,
        requestBody
      }
    });
    
    return new Response(JSON.stringify({ error: 'Unexpected error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
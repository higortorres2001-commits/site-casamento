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
  let userIdToUpdate: string | undefined;

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
        context: 'admin-update-user-unauthorized',
        message: 'Non-admin user attempted to update user',
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
    const { userIdToUpdate: targetUserId, name, email, access, isAdmin: targetIsAdmin } = requestBody;

    if (!targetUserId) {
      return new Response(JSON.stringify({ error: 'userIdToUpdate is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    userIdToUpdate = targetUserId;

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-update-user-start',
      message: 'Admin started user update process',
      metadata: {
        adminUserId,
        userIdToUpdate,
        requestedChanges: { name, email, access, isAdmin: targetIsAdmin }
      }
    });

    // 4. Get current user data to compare
    const { data: currentUserData, error: currentUserError } = await supabase
      .from('profiles')
      .select('name, email, access, is_admin')
      .eq('id', userIdToUpdate)
      .single();

    if (currentUserError || !currentUserData) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-update-user-not-found',
        message: 'Target user not found',
        metadata: {
          adminUserId,
          userIdToUpdate,
          error: currentUserError?.message
        }
      });

      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Update profile in database
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        name: name || currentUserData.name,
        email: email?.toLowerCase().trim() || currentUserData.email,
        access: access || currentUserData.access,
        is_admin: targetIsAdmin !== undefined ? targetIsAdmin : currentUserData.is_admin,
        updated_at: new Date().toISOString()
      })
      .eq('id', userIdToUpdate);

    if (profileUpdateError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-update-user-profile-error',
        message: 'Failed to update user profile',
        metadata: {
          adminUserId,
          userIdToUpdate,
          error: profileUpdateError.message,
          errorType: profileUpdateError.name,
          errorCode: profileUpdateError.code
        }
      });

      return new Response(JSON.stringify({ error: 'Failed to update user profile: ' + profileUpdateError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-update-user-profile-success',
      message: 'User profile updated successfully',
      metadata: {
        adminUserId,
        userIdToUpdate,
        previousData: currentUserData,
        newData: { name, email, access, isAdmin: targetIsAdmin }
      }
    });

    // 6. Update auth email if it changed
    let authUpdateResult = { success: true, message: 'Profile updated successfully' };

    if (email && email.toLowerCase().trim() !== currentUserData.email?.toLowerCase()) {
      try {
        const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
          userIdToUpdate,
          { email: email.toLowerCase().trim() }
        );

        if (authUpdateError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'admin-update-user-auth-error',
            message: 'Failed to update auth email',
            metadata: {
              adminUserId,
              userIdToUpdate,
              oldEmail: currentUserData.email,
              newEmail: email.toLowerCase().trim(),
              error: authUpdateError.message,
              errorType: authUpdateError.name
            }
          });

          authUpdateResult = {
            success: false,
            message: 'Profile saved, but email could not be updated: ' + authUpdateError.message
          };
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'admin-update-user-auth-success',
            message: 'Auth email updated successfully',
            metadata: {
              adminUserId,
              userIdToUpdate,
              oldEmail: currentUserData.email,
              newEmail: email.toLowerCase().trim()
            }
          });
        }
      } catch (authError: any) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-update-user-auth-exception',
          message: 'Exception updating auth email',
          metadata: {
            adminUserId,
            userIdToUpdate,
            error: authError.message,
            errorStack: authError.stack
          }
        });

        authUpdateResult = {
          success: false,
          message: 'Profile saved, but email update failed due to an unexpected error'
        };
      }
    }

    // 7. Return success response
    await supabase.from('logs').insert({
      level: 'info',
      context: 'admin-update-user-complete',
      message: 'Admin user update process completed',
      metadata: {
        adminUserId,
        userIdToUpdate,
        authUpdateSuccess: authUpdateResult.success
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: authUpdateResult.message,
      authUpdateSuccess: authUpdateResult.success
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'admin-update-user-unhandled-error',
      message: `Unhandled error in admin-update-user: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        adminUserId,
        userIdToUpdate,
        requestBody: {
          ...requestBody,
          // Remove sensitive data from logs
          password: 'REDACTED',
          creditCard: 'REDACTED'
        }
      }
    });

    return new Response(JSON.stringify({ error: 'Unexpected error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
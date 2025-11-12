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
    const { action } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'diagnose-user-issues-start',
      message: 'Starting user issues diagnosis',
      metadata: { action }
    });

    // 1. Buscar todos os usuários do auth
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
    
    if (authError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'diagnose-user-issues-auth-error',
        message: 'Failed to list auth users',
        metadata: { error: authError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to list auth users' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar todos os perfis
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, cpf, whatsapp, access, created_at');

    if (profilesError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'diagnose-user-issues-profiles-error',
        message: 'Failed to list profiles',
        metadata: { error: profilesError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to list profiles' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Analisar inconsistências
    const authUserIds = new Set(authUsers.users.map(u => u.id));
    const profileUserIds = new Set(profiles?.map(p => p.id) || []);
    
    // Usuários auth sem profile
    const authWithoutProfile = authUsers.users.filter(u => !profileUserIds.has(u.id));
    
    // Profiles sem auth (isso não deveria acontecer, mas vamos verificar)
    const profilesWithoutAuth = (profiles || []).filter(p => !authUserIds.has(p.id));
    
    // Usuários com emails diferentes entre auth e profile
    const emailMismatches = [];
    for (const authUser of authUsers.users) {
      const profile = profiles?.find(p => p.id === authUser.id);
      if (profile && profile.email && authUser.email && 
          profile.email.toLowerCase() !== authUser.email.toLowerCase()) {
        emailMismatches.push({
          userId: authUser.id,
          authEmail: authUser.email,
          profileEmail: profile.email
        });
      }
    }

    const diagnosis = {
      totalAuthUsers: authUsers.users.length,
      totalProfiles: profiles?.length || 0,
      authWithoutProfile: authWithoutProfile.length,
      profilesWithoutAuth: profilesWithoutAuth.length,
      emailMismatches: emailMismatches.length,
      issues: {
        authWithoutProfile: authWithoutProfile.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          user_metadata: u.user_metadata
        })),
        profilesWithoutAuth: profilesWithoutAuth.map(p => ({
          id: p.id,
          email: p.email,
          name: p.name,
          created_at: p.created_at
        })),
        emailMismatches
      }
    };

    await supabase.from('logs').insert({
      level: 'info',
      context: 'diagnose-user-issues-results',
      message: 'User issues diagnosis completed',
      metadata: diagnosis
    });

    // 4. Se a ação for 'fix', tentar corrigir os problemas
    if (action === 'fix') {
      let fixedCount = 0;
      
      // Corrigir usuários auth sem profile
      for (const authUser of authWithoutProfile) {
        try {
          const userMetadata = authUser.user_metadata || {};
          
          const { error: createProfileError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              name: userMetadata.name || authUser.email?.split('@')[0] || 'Usuário',
              cpf: userMetadata.cpf || '',
              email: authUser.email,
              whatsapp: userMetadata.whatsapp || '',
              access: [],
              primeiro_acesso: true,
              has_changed_password: false,
              is_admin: false,
              created_at: new Date().toISOString()
            });

          if (createProfileError) {
            await supabase.from('logs').insert({
              level: 'error',
              context: 'diagnose-user-issues-fix-error',
              message: 'Failed to create missing profile',
              metadata: { 
                userId: authUser.id,
                email: authUser.email,
                error: createProfileError.message
              }
            });
          } else {
            fixedCount++;
            await supabase.from('logs').insert({
              level: 'info',
              context: 'diagnose-user-issues-fix-success',
              message: 'Created missing profile for auth user',
              metadata: { 
                userId: authUser.id,
                email: authUser.email
              }
            });
          }
        } catch (error: any) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'diagnose-user-issues-fix-exception',
            message: 'Exception while creating missing profile',
            metadata: { 
              userId: authUser.id,
              email: authUser.email,
              error: error.message
            }
          });
        }
      }

      // Corrigir emails divergentes
      for (const mismatch of emailMismatches) {
        try {
          const { error: updateProfileError } = await supabase
            .from('profiles')
            .update({ email: mismatch.authEmail.toLowerCase() })
            .eq('id', mismatch.userId);

          if (updateProfileError) {
            await supabase.from('logs').insert({
              level: 'error',
              context: 'diagnose-user-issues-email-fix-error',
              message: 'Failed to fix email mismatch',
              metadata: { 
                userId: mismatch.userId,
                authEmail: mismatch.authEmail,
                profileEmail: mismatch.profileEmail,
                error: updateProfileError.message
              }
            });
          } else {
            fixedCount++;
            await supabase.from('logs').insert({
              level: 'info',
              context: 'diagnose-user-issues-email-fix-success',
              message: 'Fixed email mismatch',
              metadata: { 
                userId: mismatch.userId,
                oldEmail: mismatch.profileEmail,
                newEmail: mismatch.authEmail
              }
            });
          }
        } catch (error: any) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'diagnose-user-issues-email-fix-exception',
            message: 'Exception while fixing email mismatch',
            metadata: { 
              userId: mismatch.userId,
              error: error.message
            }
          });
        }
      }

      diagnosis.fixedCount = fixedCount;
    }

    return new Response(JSON.stringify({
      success: true,
      diagnosis,
      message: action === 'fix' ? `Diagnosis completed. Fixed ${diagnosis.fixedCount || 0} issues.` : 'Diagnosis completed.'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'diagnose-user-issues-unhandled-error',
      message: `Unhandled error in diagnose-user-issues: ${error.message}`,
      metadata: {
        errorStack: error.stack
      }
    });
    
    return new Response(JSON.stringify({ error: 'Unexpected error: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
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
    const { email, userId } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'diagnose-user-issue-start',
      message: 'Starting comprehensive user diagnosis',
      metadata: { 
        email: email?.toLowerCase(),
        userId,
        timestamp: new Date().toISOString()
      }
    });

    const diagnosis: any = {
      timestamp: new Date().toISOString(),
      email: email?.toLowerCase(),
      userId,
      checks: {}
    };

    // CHECK 1: Buscar no Auth por email
    try {
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        diagnosis.checks.auth_lookup = { 
          status: 'error', 
          error: authError.message 
        };
      } else {
        const userByEmail = authUsers.users?.find(u => u.email?.toLowerCase() === email?.toLowerCase());
        const userById = authUsers.users?.find(u => u.id === userId);
        
        diagnosis.checks.auth_lookup = {
          status: 'success',
          total_users: authUsers.users?.length || 0,
          found_by_email: !!userByEmail,
          found_by_id: !!userById,
          user_by_email: userByEmail ? {
            id: userByEmail.id,
            email: userByEmail.email,
            created_at: userByEmail.created_at,
            email_confirmed_at: userByEmail.email_confirmed_at
          } : null,
          user_by_id: userById ? {
            id: userById.id,
            email: userById.email,
            created_at: userById.created_at,
            email_confirmed_at: userById.email_confirmed_at
          } : null
        };
      }
    } catch (authException: any) {
      diagnosis.checks.auth_lookup = { 
        status: 'exception', 
        error: authException.message 
      };
    }

    // CHECK 2: Buscar no Profiles por email
    try {
      const { data: profileByEmail, error: profileEmailError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email?.toLowerCase())
        .single();

      diagnosis.checks.profile_by_email = {
        status: profileEmailError ? 'not_found' : 'found',
        error: profileEmailError?.message,
        data: profileByEmail || null
      };
    } catch (profileEmailException: any) {
      diagnosis.checks.profile_by_email = { 
        status: 'exception', 
        error: profileEmailException.message 
      };
    }

    // CHECK 3: Buscar no Profiles por ID
    try {
      const { data: profileById, error: profileIdError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      diagnosis.checks.profile_by_id = {
        status: profileIdError ? 'not_found' : 'found',
        error: profileIdError?.message,
        data: profileById || null
      };
    } catch (profileIdException: any) {
      diagnosis.checks.profile_by_id = { 
        status: 'exception', 
        error: profileIdException.message 
      };
    }

    // CHECK 4: Verificar logs relacionados
    try {
      const { data: relatedLogs, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .or(`metadata->>email.eq.${email?.toLowerCase()},metadata->>userId.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(10);

      diagnosis.checks.related_logs = {
        status: logsError ? 'error' : 'success',
        error: logsError?.message,
        count: relatedLogs?.length || 0,
        recent_logs: relatedLogs?.slice(0, 5) || []
      };
    } catch (logsException: any) {
      diagnosis.checks.related_logs = { 
        status: 'exception', 
        error: logsException.message 
      };
    }

    // CHECK 5: Verificar se há conflitos de ID
    try {
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, email, created_at')
        .limit(1000);

      if (!allProfilesError && allProfiles) {
        const duplicateEmails = allProfiles.filter(p => p.email?.toLowerCase() === email?.toLowerCase());
        const duplicateIds = allProfiles.filter(p => p.id === userId);
        
        diagnosis.checks.conflict_analysis = {
          status: 'success',
          total_profiles: allProfiles.length,
          duplicate_emails: duplicateEmails.length,
          duplicate_ids: duplicateIds.length,
          duplicate_email_records: duplicateEmails,
          duplicate_id_records: duplicateIds
        };
      } else {
        diagnosis.checks.conflict_analysis = {
          status: 'error',
          error: allProfilesError?.message
        };
      }
    } catch (conflictException: any) {
      diagnosis.checks.conflict_analysis = { 
        status: 'exception', 
        error: conflictException.message 
      };
    }

    // CHECK 6: Testar criação de perfil com ID único
    try {
      const testUserId = crypto.randomUUID();
      const testEmail = `test-${Date.now()}@example.com`;
      
      const { error: testCreateError } = await supabase
        .from('profiles')
        .insert({
          id: testUserId,
          name: 'Test User',
          cpf: '12345678901',
          email: testEmail,
          whatsapp: '11999999999',
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString()
        });

      if (testCreateError) {
        diagnosis.checks.test_profile_creation = {
          status: 'failed',
          error: testCreateError.message,
          errorCode: testCreateError.code
        };
      } else {
        // Limpar o teste
        await supabase.from('profiles').delete().eq('id', testUserId);
        
        diagnosis.checks.test_profile_creation = {
          status: 'success',
          message: 'Profile creation works normally'
        };
      }
    } catch (testException: any) {
      diagnosis.checks.test_profile_creation = { 
        status: 'exception', 
        error: testException.message 
      };
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'diagnose-user-issue-complete',
      message: 'User diagnosis completed',
      metadata: { 
        email: email?.toLowerCase(),
        userId,
        diagnosis
      }
    });

    return new Response(JSON.stringify({
      success: true,
      diagnosis
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'diagnose-user-issue-error',
      message: `Diagnosis failed: ${error.message}`,
      metadata: {
        error: error.message,
        errorStack: error.stack
      }
    });

    return new Response(JSON.stringify({ 
      error: 'Diagnosis failed: ' + error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
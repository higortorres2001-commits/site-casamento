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
    const { email, userId, action = 'diagnose' } = await req.json();

    await supabase.from('logs').insert({
      level: 'info',
      context: 'supabase-bug-diagnosis-start',
      message: 'Starting comprehensive Supabase bug diagnosis',
      metadata: { 
        email: email?.toLowerCase(),
        userId,
        action,
        timestamp: new Date().toISOString()
      }
    });

    const diagnosis: any = {
      timestamp: new Date().toISOString(),
      email: email?.toLowerCase(),
      userId,
      checks: {},
      recommendations: []
    };

    // CHECK 1: Verificar Auth Users com múltiplas abordagens
    try {
      // Abordagem 1: Listar todos os usuários
      const { data: allAuthUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        diagnosis.checks.auth_comprehensive = { 
          status: 'error', 
          error: authError.message 
        };
      } else {
        const userByEmail = allAuthUsers.users?.find(u => u.email?.toLowerCase() === email?.toLowerCase());
        const userById = allAuthUsers.users?.find(u => u.id === userId);
        
        // Abordagem 2: Tentar buscar usuário específico por ID
        let specificUserById = null;
        if (userId) {
          try {
            const { data: specificUser, error: specificError } = await supabase.auth.admin.getUserById(userId);
            specificUserById = specificUser?.user || null;
          } catch (e: any) {
            diagnosis.checks.auth_specific_lookup = {
              status: 'error',
              error: e.message
            };
          }
        }
        
        diagnosis.checks.auth_comprehensive = {
          status: 'success',
          total_users: allAuthUsers.users?.length || 0,
          found_by_email_in_list: !!userByEmail,
          found_by_id_in_list: !!userById,
          found_by_id_specific: !!specificUserById,
          user_by_email: userByEmail ? {
            id: userByEmail.id,
            email: userByEmail.email,
            created_at: userByEmail.created_at,
            email_confirmed_at: userByEmail.email_confirmed_at,
            last_sign_in_at: userByEmail.last_sign_in_at
          } : null,
          user_by_id_list: userById ? {
            id: userById.id,
            email: userById.email,
            created_at: userById.created_at
          } : null,
          user_by_id_specific: specificUserById ? {
            id: specificUserById.id,
            email: specificUserById.email,
            created_at: specificUserById.created_at
          } : null
        };
      }
    } catch (authException: any) {
      diagnosis.checks.auth_comprehensive = { 
        status: 'exception', 
        error: authException.message 
      };
    }

    // CHECK 2: Verificar Profiles com múltiplas consultas
    try {
      // Por email
      const { data: profileByEmail, error: profileEmailError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email?.toLowerCase());

      // Por ID
      const { data: profileById, error: profileIdError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId);

      // Busca geral para verificar padrões
      const { data: allProfiles, error: allProfilesError } = await supabase
        .from('profiles')
        .select('id, email, created_at, name')
        .order('created_at', { ascending: false })
        .limit(100);

      diagnosis.checks.profiles_comprehensive = {
        by_email: {
          status: profileEmailError ? 'error' : 'success',
          error: profileEmailError?.message,
          count: profileByEmail?.length || 0,
          data: profileByEmail || []
        },
        by_id: {
          status: profileIdError ? 'error' : 'success', 
          error: profileIdError?.message,
          count: profileById?.length || 0,
          data: profileById || []
        },
        recent_profiles: {
          status: allProfilesError ? 'error' : 'success',
          error: allProfilesError?.message,
          count: allProfiles?.length || 0,
          sample: allProfiles?.slice(0, 5) || []
        }
      };
    } catch (profileException: any) {
      diagnosis.checks.profiles_comprehensive = { 
        status: 'exception', 
        error: profileException.message 
      };
    }

    // CHECK 3: Testar criação com ID específico que falhou
    if (action === 'test_creation' && userId) {
      try {
        const testEmail = `test-debug-${Date.now()}@example.com`;
        
        // Primeiro, verificar se o ID realmente não existe
        const { data: existingProfile, error: existingError } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', userId)
          .single();

        diagnosis.checks.pre_creation_check = {
          id_exists: !existingError && !!existingProfile,
          error: existingError?.message,
          errorCode: existingError?.code
        };

        // Tentar criar com o ID problemático
        const { error: testCreateError } = await supabase
          .from('profiles')
          .insert({
            id: userId,
            name: 'Test Debug User',
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
          diagnosis.checks.test_creation_with_problematic_id = {
            status: 'failed',
            error: testCreateError.message,
            errorCode: testCreateError.code,
            errorDetails: testCreateError
          };
        } else {
          // Limpar o teste
          await supabase.from('profiles').delete().eq('id', userId);
          
          diagnosis.checks.test_creation_with_problematic_id = {
            status: 'success',
            message: 'ID can be used normally now - possible cache/timing issue'
          };
        }
      } catch (testException: any) {
        diagnosis.checks.test_creation_with_problematic_id = { 
          status: 'exception', 
          error: testException.message 
        };
      }
    }

    // CHECK 4: Verificar índices e constraints da tabela
    try {
      const { data: tableInfo, error: tableError } = await supabase
        .rpc('get_table_constraints', { table_name: 'profiles' })
        .single();

      diagnosis.checks.table_constraints = {
        status: tableError ? 'error' : 'success',
        error: tableError?.message,
        data: tableInfo || null
      };
    } catch (constraintException: any) {
      diagnosis.checks.table_constraints = { 
        status: 'exception', 
        error: constraintException.message 
      };
    }

    // ANÁLISE E RECOMENDAÇÕES
    if (diagnosis.checks.auth_comprehensive?.found_by_email_in_list && 
        !diagnosis.checks.profiles_comprehensive?.by_email?.count) {
      diagnosis.recommendations.push({
        issue: 'Auth user exists without profile',
        solution: 'Create profile for existing auth user',
        priority: 'high'
      });
    }

    if (diagnosis.checks.test_creation_with_problematic_id?.status === 'failed' &&
        diagnosis.checks.pre_creation_check?.id_exists === false) {
      diagnosis.recommendations.push({
        issue: 'Ghost duplicate constraint violation',
        solution: 'Possible cache issue or phantom transaction',
        priority: 'critical',
        actions: ['Clear Supabase cache', 'Check for phantom transactions', 'Use different ID generation strategy']
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'supabase-bug-diagnosis-complete',
      message: 'Comprehensive diagnosis completed',
      metadata: { 
        email: email?.toLowerCase(),
        userId,
        diagnosis,
        recommendationCount: diagnosis.recommendations.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      diagnosis,
      recommendations: diagnosis.recommendations
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'supabase-bug-diagnosis-error',
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
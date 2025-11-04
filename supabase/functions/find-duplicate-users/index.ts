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
    // 1. Listar todos os usuários auth
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao listar usuários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Agrupar por email para encontrar duplicatas
    const emailGroups: Record<string, any[]> = {};
    
    authUsers.users.forEach(user => {
      const email = user.email?.toLowerCase();
      if (email) {
        if (!emailGroups[email]) {
          emailGroups[email] = [];
        }
        emailGroups[email].push(user);
      }
    });

    // 3. Encontrar emails duplicados
    const duplicates = Object.entries(emailGroups)
      .filter(([email, users]) => users.length > 1)
      .map(([email, users]) => ({
        email,
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          user_metadata: u.user_metadata
        }))
      }));

    // 4. Buscar profiles correspondentes
    const duplicatesWithProfiles = await Promise.all(
      duplicates.map(async (duplicate) => {
        const userIds = duplicate.users.map(u => u.id);
        
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .in('id', userIds);

        return {
          ...duplicate,
          profiles: profiles || [],
          profileError
        };
      })
    );

    // 5. Log do resultado
    await supabase.from('logs').insert({
      level: 'info',
      context: 'find-duplicate-users',
      message: `Found ${duplicates.length} emails with duplicate users`,
      metadata: { 
        totalUsers: authUsers.users.length,
        duplicateCount: duplicates.length,
        duplicates: duplicates.map(d => ({ email: d.email, userCount: d.users.length }))
      }
    });

    return new Response(JSON.stringify({
      success: true,
      totalUsers: authUsers.users.length,
      duplicateCount: duplicates.length,
      duplicates: duplicatesWithProfiles
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'find-duplicate-users',
      message: `Unhandled error: ${error.message}`,
      metadata: { 
        errorStack: error.stack 
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
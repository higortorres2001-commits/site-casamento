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
    const { email, keepUserId } = await req.json();

    if (!email || !keepUserId) {
      return new Response(JSON.stringify({ error: 'email e keepUserId são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fixing duplicate users for email: ${email}, keeping user: ${keepUserId}`);

    // 1. Listar todos os usuários
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao listar usuários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Encontrar todos os usuários com o mesmo email
    const duplicateUsers = authUsers.users.filter(u => 
      u.email?.toLowerCase() === email.toLowerCase() && u.id !== keepUserId
    );

    if (duplicateUsers.length === 0) {
      return new Response(JSON.stringify({ error: 'Nenhum usuário duplicado encontrado' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${duplicateUsers.length} duplicate users to delete`);

    // 3. Deletar os usuários duplicados
    const deleteResults = [];
    for (const user of duplicateUsers) {
      console.log(`Deleting duplicate user: ${user.id} (${user.email})`);
      
      const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
      
      deleteResults.push({
        userId: user.id,
        email: user.email,
        success: !deleteError,
        error: deleteError?.message
      });

      if (deleteError) {
        console.error(`Error deleting user ${user.id}:`, deleteError);
      } else {
        console.log(`Successfully deleted user ${user.id}`);
      }
    }

    // 4. Verificar se há profiles órfãos
    const deletedUserIds = duplicateUsers.map(u => u.id);
    const { data: orphanProfiles, error: orphanError } = await supabase
      .from('profiles')
      .select('*')
      .in('id', deletedUserIds);

    if (orphanError) {
      console.error('Error checking orphan profiles:', orphanError);
    } else if (orphanProfiles && orphanProfiles.length > 0) {
      console.log(`Found ${orphanProfiles.length} orphan profiles to delete`);
      
      // Deletar profiles órfãos
      for (const profile of orphanProfiles) {
        const { error: profileDeleteError } = await supabase
          .from('profiles')
          .delete()
          .eq('id', profile.id);
        
        if (profileDeleteError) {
          console.error(`Error deleting orphan profile ${profile.id}:`, profileDeleteError);
        } else {
          console.log(`Successfully deleted orphan profile ${profile.id}`);
        }
      }
    }

    // 5. Log do resultado
    await supabase.from('logs').insert({
      level: 'info',
      context: 'fix-duplicate-users',
      message: `Fixed duplicate users for email: ${email}`,
      metadata: { 
        email,
        keepUserId,
        deletedUsers: deleteResults,
        orphanProfilesCount: orphanProfiles?.length || 0
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Usuários duplicados corrigidos com sucesso!',
      deletedUsers: deleteResults,
      orphanProfilesCount: orphanProfiles?.length || 0
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'fix-duplicate-users',
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
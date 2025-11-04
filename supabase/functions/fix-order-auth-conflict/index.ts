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
    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(JSON.stringify({ error: 'orderId é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Fixing auth conflict for order: ${orderId}`);

    // 1. Buscar pedido
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Pedido não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Buscar profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', order.user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found:', profileError);
      return new Response(JSON.stringify({ error: 'Profile não encontrado' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Verificar se existe usuário auth com o mesmo email
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao listar usuários' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingAuthUser = authUsers.users.find(u => 
      u.email?.toLowerCase() === profile.email?.toLowerCase()
    );

    if (!existingAuthUser) {
      console.log('No auth user found with profile email, creating new one');
      
      // Criar usuário auth usando CPF como senha
      const cleanCpf = profile.cpf?.replace(/[^\d]+/g, '');
      
      if (!cleanCpf || cleanCpf.length !== 11) {
        return new Response(JSON.stringify({ error: 'CPF inválido no profile' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: profile.email,
        password: cleanCpf,
        email_confirm: true,
        user_metadata: { 
          name: profile.name,
          cpf: cleanCpf,
          whatsapp: profile.whatsapp
        },
      });

      if (createError || !newUser?.user) {
        console.error('Error creating auth user:', createError);
        return new Response(JSON.stringify({ error: 'Erro ao criar usuário auth' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Atualizar profile para usar o novo ID do auth
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          id: newUser.user.id,
          has_changed_password: false,
          primeiro_acesso: true
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'fix-order-auth-conflict',
        message: 'Created new auth user for existing profile',
        metadata: { 
          orderId,
          profileId: profile.id,
          newAuthId: newUser.user.id,
          email: profile.email
        }
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Usuário auth criado e profile atualizado',
        newAuthId: newUser.user.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Se existe usuário auth, verificar se IDs são diferentes
    if (existingAuthUser.id !== profile.id) {
      console.log(`Auth user exists with different ID. Auth: ${existingAuthUser.id}, Profile: ${profile.id}`);
      
      // Atualizar profile para usar o ID do auth existente
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          id: existingAuthUser.id
        })
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating profile ID:', updateError);
        return new Response(JSON.stringify({ error: 'Erro ao atualizar profile' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'fix-order-auth-conflict',
        message: 'Updated profile to use existing auth user ID',
        metadata: { 
          orderId,
          profileId: profile.id,
          authId: existingAuthUser.id,
          email: profile.email
        }
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Profile atualizado para usar ID do auth existente',
        authId: existingAuthUser.id
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 5. Se IDs são iguais, não há problema
    await supabase.from('logs').insert({
      level: 'info',
      context: 'fix-order-auth-conflict',
      message: 'No auth conflict found - IDs are aligned',
      metadata: { 
        orderId,
        profileId: profile.id,
        authId: existingAuthUser.id,
        email: profile.email
      }
    });

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Nenhum conflito encontrado - IDs já alinhados'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'fix-order-auth-conflict',
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
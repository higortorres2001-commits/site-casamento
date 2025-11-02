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

  let userId: string | undefined;
  let orderId: string | undefined;
  let asaasPaymentId: string | undefined;
  let requestBody: any;

  try {
    requestBody = await req.json();
    const { name, email, cpf, whatsapp, productIds } = requestBody;

    if (!name || !email || !cpf || !whatsapp || !productIds || !Array.isArray(productIds) || productIds.length === 0) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Missing required fields in request body.',
        metadata: { requestBody }
      });
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificação mais robusta de usuário existente
    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({
      email,
    });

    if (listUsersError) {
      console.error('Error listing users:', listUsersError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'create-asaas-payment',
        message: 'Failed to check for existing user.',
        metadata: { email, error: listUsersError.message }
      });
      return new Response(JSON.stringify({ error: 'Failed to check for existing user.' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Filtrar usuários com email EXATAMENTE igual
    const exactMatchUsers = existingUsers.users.filter(u => u.email === email);

    if (exactMatchUsers.length > 0) {
      // Usuário já existe, usar o primeiro usuário com email exato
      userId = exactMatchUsers[0].id;
      console.log(`Existing user found: ${userId}`);
      
      // Atualizar perfil do usuário existente
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ 
          name, 
          cpf, 
          email, 
          whatsapp,
          // Adicionar log de atualização
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating existing user profile:', updateProfileError);
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'create-asaas-payment',
          message: 'Error updating existing user profile.',
          metadata: { userId, error: updateProfileError.message }
        });
      }
    } else {
      // Criar novo usuário se não existir
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email,
        password: cpf,
        email_confirm: true,
        user_metadata: { name, cpf, whatsapp },
      });

      if (createUserError || !newUser?.user) {
        console.error('Error creating new user:', createUserError);
        await supabase.from('logs').insert({
          level: 'error',
          context: 'create-asaas-payment',
          message: 'Failed to create new user account.',
          metadata: { email, error: createUserError?.message }
        });
        return new Response(JSON.stringify({ error: 'Failed to create new user account.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = newUser.user.id;
      console.log(`New user created: ${userId}`);
    }

    // Resto do código permanece igual
    // ...
  } catch (error) {
    console.error('Edge Function error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'create-asaas-payment',
      message: `Unhandled error in Edge Function: ${error.message}`,
      metadata: {
        errorStack: error.stack,
        userId,
        orderId,
        asaasPaymentId,
        requestBody,
      }
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
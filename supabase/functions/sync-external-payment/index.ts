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
    const { email, name, cpf, whatsapp, asaasPaymentId, productIds, totalValue, installmentCount } = await req.json();

    if (!email || !name || !cpf || !whatsapp || !asaasPaymentId || !productIds || !Array.isArray(productIds)) {
      return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Limpar CPF
    const cleanCpf = cpf.replace(/[^\d]+/g, '');
    
    if (cleanCpf.length !== 11) {
      return new Response(JSON.stringify({ error: 'CPF inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'sync-external-payment',
      message: 'Starting external payment sync',
      metadata: { email, name, cpf: cleanCpf, asaasPaymentId, productIds, totalValue, installmentCount }
    });

    // 1. Check if user exists
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
      console.error('Error listing users:', listError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar usuários existentes' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingUser = authUsers.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      console.log(`Existing user found: ${userId}`);
      
      // Update profile
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ name, cpf: cleanCpf, email, whatsapp })
        .eq('id', userId);

      if (updateProfileError) {
        console.error('Error updating profile:', updateProfileError);
      }

      // Reset password to CPF
      const { error: resetPasswordError } = await supabase.auth.admin.updateUserById(
        userId,
        { password: cleanCpf }
      );

      if (resetPasswordError) {
        console.error('Error resetting password:', resetPasswordError);
      }
    } else {
      // Create new user
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password: cleanCpf,
        email_confirm: true,
        user_metadata: { name, cpf: cleanCpf, whatsapp },
      });

      if (createUserError || !newUser?.user) {
        console.error('Error creating user:', createUserError);
        return new Response(JSON.stringify({ error: 'Erro ao criar usuário: ' + (createUserError?.message || 'Unknown error') }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      userId = newUser.user.id;
      console.log(`New user created: ${userId}`);

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name,
          cpf: cleanCpf,
          email,
          whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false
        });
      
      if (profileError) {
        console.error('Error creating profile:', profileError);
      }
    }

    // 2. Create order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        user_id: userId,
        ordered_product_ids: productIds,
        total_price: totalValue,
        status: 'paid', // Payment already confirmed
        asaas_payment_id: asaasPaymentId,
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error('Error creating order:', orderError);
      return new Response(JSON.stringify({ error: 'Erro ao criar pedido' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 3. Update user access with products
    const { data: currentProfile } = await supabase
      .from('profiles')
      .select('access')
      .eq('id', userId)
      .single();

    if (currentProfile) {
      const existingAccess = Array.isArray(currentProfile.access) ? currentProfile.access : [];
      const newAccess = [...new Set([...existingAccess, ...productIds])];

      const { error: updateAccessError } = await supabase
        .from('profiles')
        .update({ access: newAccess })
        .eq('id', userId);

      if (updateAccessError) {
        console.error('Error updating access:', updateAccessError);
      }
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'sync-external-payment',
      message: 'External payment synced successfully',
      metadata: { userId, orderId: order.id, asaasPaymentId, productIds }
    });

    return new Response(JSON.stringify({ 
      success: true,
      userId,
      orderId: order.id,
      message: 'Pagamento sincronizado com sucesso!'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Unexpected error:', error);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'sync-external-payment',
      message: 'Unexpected error',
      metadata: { 
        errorMessage: error.message, 
        errorStack: error.stack 
      }
    });
    return new Response(JSON.stringify({ error: 'Erro inesperado: ' + error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
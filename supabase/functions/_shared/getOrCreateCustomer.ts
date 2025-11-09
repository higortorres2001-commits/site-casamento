import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface GetOrCreateCustomerInput {
  supabase: any;
  email: string;
  name: string;
  cpf: string;
  whatsapp: string;
}

interface GetOrCreateCustomerOutput {
  userId: string;
  isNewUser: boolean;
  existingUser?: any;
}

export async function getOrCreateCustomer({
  supabase,
  email,
  name,
  cpf,
  whatsapp
}: GetOrCreateCustomerInput): Promise<GetOrCreateCustomerOutput> {
  const cleanCpf = cpf.replace(/[^\d]+/g, '');
  const cleanWhatsapp = whatsapp.replace(/\D/g, '');
  const cleanEmail = email.toLowerCase().trim();

  console.log('🔍 getOrCreateCustomer - Starting process', {
    email: cleanEmail,
    name,
    cleanCpfLength: cleanCpf.length,
    cleanWhatsappLength: cleanWhatsapp.length
  });

  // ETAPA 1: Verificar se o usuário existe
  console.log('📧 Checking if user exists:', cleanEmail);
  
  const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ 
    email: cleanEmail 
  });

  if (listUsersError) {
    console.error('❌ Error listing users:', listUsersError);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'getOrCreateCustomer-listUsers',
      message: 'Failed to check for existing user',
      metadata: { 
        email: cleanEmail,
        error: listUsersError.message,
        errorType: listUsersError.name
      }
    });
    throw new Error(`Failed to check for existing user: ${listUsersError.message}`);
  }

  const existingUser = existingUsers.users && existingUsers.users.length > 0 ? existingUsers.users[0] : null;
  
  if (existingUser) {
    console.log('✅ Existing user found:', existingUser.id);
    
    // ETAPA 2: Atualizar perfil do usuário existente
    console.log('🔄 Updating existing user profile');
    
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ 
        name, 
        cpf: cleanCpf, 
        email: cleanEmail, 
        whatsapp: cleanWhatsapp,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id);

    if (updateProfileError) {
      console.error('❌ Error updating existing user profile:', updateProfileError);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'getOrCreateCustomer-updateProfile',
        message: 'Failed to update existing user profile',
        metadata: { 
          userId: existingUser.id,
          email: cleanEmail,
          name,
          error: updateProfileError.message,
          errorType: updateProfileError.name
        }
      });
      // Continuar mesmo com erro de update - o pagamento ainda pode ser processado
    } else {
      console.log('✅ Existing user profile updated successfully');
      await supabase.from('logs').insert({
        level: 'info',
        context: 'getOrCreateCustomer-updateProfile',
        message: 'Existing user profile updated successfully',
        metadata: { 
          userId: existingUser.id,
          email: cleanEmail,
          name
        }
      });
    }

    return {
      userId: existingUser.id,
      isNewUser: false,
      existingUser
    };
  }

  // ETAPA 3: Criar novo usuário
  console.log('👤 Creating new user');
  
  const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: cleanEmail,
    password: cleanCpf, // Usar CPF limpo como senha
    email_confirm: true,
    user_metadata: { 
      name, 
      cpf: cleanCpf, 
      whatsapp: cleanWhatsapp,
      created_via: 'checkout'
    },
  });

  if (createUserError || !newUser?.user) {
    console.error('❌ Error creating new user:', createUserError);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'getOrCreateCustomer-createUser',
      message: 'Failed to create new user',
      metadata: { 
        email: cleanEmail,
        name,
        cleanCpfLength: cleanCpf.length,
        error: createUserError?.message,
        errorType: createUserError?.name,
        errorCode: createUserError?.code
      }
    });
    throw new Error(`Failed to create new user: ${createUserError?.message || 'Unknown error'}`);
  }

  console.log('✅ New user created:', newUser.user.id);
  
  await supabase.from('logs').insert({
    level: 'info',
    context: 'getOrCreateCustomer-createUser',
    message: 'New user created successfully',
    metadata: { 
      userId: newUser.user.id,
      email: cleanEmail,
      name,
      cleanCpfLength: cleanCpf.length
    }
  });

  // ETAPA 4: Criar perfil para o novo usuário
  console.log('📝 Creating profile for new user');
  
  const { error: profileError, data: profileData } = await supabase
    .from('profiles')
    .insert({
      id: newUser.user.id,
      name,
      cpf: cleanCpf,
      email: cleanEmail,
      whatsapp: cleanWhatsapp,
      access: [],
      primeiro_acesso: true,
      has_changed_password: false,
      is_admin: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (profileError) {
    console.error('❌ Error creating profile for new user:', profileError);
    await supabase.from('logs').insert({
      level: 'error',
      context: 'getOrCreateCustomer-createProfile',
      message: 'Failed to create profile for new user',
      metadata: { 
        userId: newUser.user.id,
        email: cleanEmail,
        name,
        error: profileError.message,
        errorType: profileError.name,
        errorCode: profileError.code
      }
    });
    // Não falhar completamente - o usuário foi criado no auth
  } else {
    console.log('✅ Profile created successfully for new user');
    await supabase.from('logs').insert({
      level: 'info',
      context: 'getOrCreateCustomer-createProfile',
      message: 'Profile created successfully for new user',
      metadata: { 
        userId: newUser.user.id,
        profileId: profileData?.id,
        email: cleanEmail,
        name
      }
    });
  }

  return {
    userId: newUser.user.id,
    isNewUser: true
  };
}
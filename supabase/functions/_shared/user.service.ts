import { RequestPayload, UserData } from './types.ts';

// Função para gerenciar usuário (existente ou novo) - SEMPRE cria Auth+Profile no checkout
export async function handleUserManagement(payload: RequestPayload, supabase: any): Promise<UserData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-start',
    message: 'Starting user management process (checkout flow)',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      flow: 'checkout'
    }
  });

  // ETAPA 1: Verificar se usuário já existe no Auth
  const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers();

  if (listUsersError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to list users from Auth',
      metadata: { 
        email: payload.email,
        error: listUsersError.message,
        errorType: listUsersError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente: ' + listUsersError.message);
  }

  const existingUser = existingUsers.users?.find(u => u.email?.toLowerCase() === payload.email.toLowerCase());

  if (existingUser) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found in Auth, updating profile',
      metadata: { 
        userId: existingUser.id,
        email: payload.email,
        existingUserCreated: existingUser.created_at
      }
    });

    // ETAPA 2A: Atualizar perfil do usuário existente (sem tocar no access)
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ 
        name: payload.name, 
        cpf: payload.cpf, 
        email: payload.email, 
        whatsapp: payload.whatsapp,
        updated_at: new Date().toISOString()
      })
      .eq('id', existingUser.id);

    if (updateProfileError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-update-error',
        message: 'Failed to update existing user profile, but continuing',
        metadata: { 
          userId: existingUser.id,
          error: updateProfileError.message,
          errorCode: updateProfileError.code
        }
      });
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-updated',
        message: 'Existing user profile updated successfully',
        metadata: { userId: existingUser.id }
      });
    }

    return { id: existingUser.id, isExisting: true };
  }

  // ETAPA 2B: Criar NOVO usuário (Auth + Profile) IMEDIATAMENTE
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-creating-new',
    message: 'Creating new user account (Auth + Profile) in checkout flow',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      flow: 'checkout-immediate'
    }
  });

  // Criar usuário no Auth
  const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
    email: payload.email,
    password: payload.cpf, // Senha = CPF (números)
    email_confirm: true, // Email já confirmado
    user_metadata: { 
      name: payload.name, 
      cpf: payload.cpf, 
      whatsapp: payload.whatsapp,
      created_via: 'checkout',
      created_at_checkout: new Date().toISOString()
    },
  });

  if (createUserError || !newUser?.user) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-auth-creation-error',
      message: 'CRITICAL: Failed to create Auth user in checkout',
      metadata: { 
        email: payload.email,
        error: createUserError?.message,
        errorType: createUserError?.name,
        errorCode: createUserError?.code,
        flow: 'checkout'
      }
    });
    throw new Error('Erro ao criar conta de usuário: ' + (createUserError?.message || 'Erro desconhecido'));
  }

  const userId = newUser.user.id;

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-auth-created',
    message: 'Auth user created successfully in checkout',
    metadata: { 
      userId,
      email: payload.email,
      flow: 'checkout'
    }
  });

  // Criar perfil IMEDIATAMENTE (sem acesso aos produtos ainda)
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: userId,
      name: payload.name,
      cpf: payload.cpf,
      email: payload.email,
      whatsapp: payload.whatsapp,
      access: [], // ⚠️ VAZIO - acesso será liberado pelo webhook
      primeiro_acesso: true,
      has_changed_password: false,
      is_admin: false,
      created_at: new Date().toISOString()
    });

  if (profileError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-profile-creation-error',
      message: 'CRITICAL: Failed to create profile for new user in checkout',
      metadata: { 
        userId,
        email: payload.email,
        error: profileError.message,
        errorCode: profileError.code,
        flow: 'checkout'
      }
    });
    
    // Tentar deletar o usuário do Auth para evitar inconsistência
    await supabase.auth.admin.deleteUser(userId);
    
    throw new Error('Erro ao criar perfil do usuário: ' + profileError.message);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-profile-created',
    message: 'Profile created successfully for new user in checkout (access empty, will be granted by webhook)',
    metadata: { 
      userId,
      email: payload.email,
      flow: 'checkout'
    }
  });

  return { id: userId, isExisting: false };
}
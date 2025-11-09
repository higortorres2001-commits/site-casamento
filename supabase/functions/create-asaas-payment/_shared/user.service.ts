import { RequestPayload, UserData } from './types.ts';

// Função para gerenciar usuário (existente ou novo)
export async function handleUserManagement(payload: RequestPayload, supabase: any): Promise<UserData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-start',
    message: 'Starting user management process',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length
    }
  });

  // Verificar se usuário já existe
  const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ 
    email: payload.email 
  });

  if (listUsersError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user',
      metadata: { 
        email: payload.email,
        error: listUsersError.message,
        errorType: listUsersError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente: ' + listUsersError.message);
  }

  const existingUser = existingUsers.users && existingUsers.users.length > 0 ? existingUsers.users[0] : null;

  if (existingUser) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, updating profile',
      metadata: { 
        userId: existingUser.id,
        email: payload.email,
        existingUserCreated: existingUser.created_at
      }
    });

    // Atualizar perfil do usuário existente
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
        message: 'Failed to update existing user profile, but continuing with payment',
        metadata: { 
          userId: existingUser.id,
          error: updateProfileError.message,
          errorCode: updateProfileError.code
        }
      });
      // Não falhar o processo - continuar com o pagamento
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-updated',
        message: 'Existing user profile updated successfully',
        metadata: { userId: existingUser.id }
      });
    }

    return { id: existingUser.id, isExisting: true };
  } else {
    // Criar novo usuário
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-creating-new',
      message: 'Creating new user account',
      metadata: { 
        email: payload.email,
        cpfLength: payload.cpf.length
      }
    });

    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: payload.email,
      password: payload.cpf,
      email_confirm: true,
      user_metadata: { 
        name: payload.name, 
        cpf: payload.cpf, 
        whatsapp: payload.whatsapp,
        created_via: 'checkout'
      },
    });

    if (createUserError || !newUser?.user) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-creation-error',
        message: 'Failed to create new user account',
        metadata: { 
          email: payload.email,
          error: createUserError?.message,
          errorType: createUserError?.name,
          errorCode: createUserError?.code
        }
      });
      throw new Error('Erro ao criar conta de usuário: ' + (createUserError?.message || 'Erro desconhecido'));
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-user-created',
      message: 'New user account created successfully',
      metadata: { 
        userId: newUser.user.id,
        email: payload.email
      }
    });

    // Criar perfil para o novo usuário
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: newUser.user.id,
        name: payload.name,
        cpf: payload.cpf,
        email: payload.email,
        whatsapp: payload.whatsapp,
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false,
        created_at: new Date().toISOString()
      });

    if (profileError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-creation-error',
        message: 'Failed to create profile for new user, but user account was created',
        metadata: { 
          userId: newUser.user.id,
          error: profileError.message,
          errorCode: profileError.code
        }
      });
      // Não falhar - o usuário foi criado no auth
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-created',
        message: 'Profile created successfully for new user',
        metadata: { userId: newUser.user.id }
      });
    }

    return { id: newUser.user.id, isExisting: false };
  }
}
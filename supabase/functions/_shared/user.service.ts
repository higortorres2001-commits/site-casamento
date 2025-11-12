import { RequestPayload, UserData } from './types.ts';

// Função para gerenciar usuário (existente ou novo) com tratamento de concorrência
export async function handleUserManagement(payload: RequestPayload, supabase: any): Promise<UserData> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-start',
    message: 'Starting user management process',
    metadata: { 
      email: payload.email,
      cpfLength: payload.cpf.length,
      timestamp: new Date().toISOString()
    }
  });

  // ESTRATÉGIA 1: Verificar se o usuário já existe usando o email exato
  const { data: existingUserData, error: userLookupError } = await supabase.auth.admin.listUsers({
    email: payload.email.toLowerCase().trim()
  });

  if (userLookupError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user',
      metadata: { 
        email: payload.email,
        error: userLookupError.message,
        errorType: userLookupError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente: ' + userLookupError.message);
  }

  // Encontrar o usuário exato pelo email (case insensitive)
  const existingUser = existingUserData?.users?.find(u => 
    u.email?.toLowerCase() === payload.email.toLowerCase().trim()
  );

  if (existingUser) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, will update profile only after successful payment',
      metadata: { 
        userId: existingUser.id,
        email: payload.email,
        existingUserCreated: existingUser.created_at,
        existingUserLastSignIn: existingUser.last_sign_in_at
      }
    });

    // Não atualizamos o perfil aqui - apenas retornamos o ID do usuário existente
    // O perfil será atualizado apenas após o pagamento bem-sucedido
    return { id: existingUser.id, isExisting: true };
  } else {
    // ESTRATÉGIA 2: Verificar se existe algum usuário com o mesmo email (busca mais ampla)
    // Isso é uma verificação adicional para evitar duplicação
    const { data: allUsers, error: listAllError } = await supabase.auth.admin.listUsers();
    
    if (listAllError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-list-all-error',
        message: 'Failed to list all users for secondary check',
        metadata: { 
          email: payload.email,
          error: listAllError.message
        }
      });
      // Continuamos mesmo com erro, pois já fizemos a verificação principal
    } else {
      // Verificar se existe algum usuário com o mesmo email (case insensitive)
      const existingUserByEmail = allUsers?.users?.find(u => 
        u.email?.toLowerCase() === payload.email.toLowerCase().trim()
      );

      if (existingUserByEmail) {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'user-management-existing-found-secondary',
          message: 'Existing user found in secondary check',
          metadata: { 
            userId: existingUserByEmail.id,
            email: payload.email,
            existingEmail: existingUserByEmail.email
          }
        });
        
        return { id: existingUserByEmail.id, isExisting: true };
      }
    }

    // ESTRATÉGIA 3: Criar novo usuário apenas para autenticação
    // O perfil será criado apenas após o pagamento bem-sucedido
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-creating-new',
      message: 'Creating new user account (auth only, profile will be created after payment)',
      metadata: { 
        email: payload.email,
        cpfLength: payload.cpf.length,
        timestamp: new Date().toISOString()
      }
    });

    let newUser;
    let createUserAttempts = 0;
    const maxAttempts = 3;

    while (createUserAttempts < maxAttempts) {
      try {
        const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
          email: payload.email.toLowerCase().trim(),
          password: payload.cpf,
          email_confirm: true,
          user_metadata: { 
            name: payload.name, 
            cpf: payload.cpf, 
            whatsapp: payload.whatsapp,
            created_via: 'checkout',
            created_at: new Date().toISOString()
          },
        });

        if (createUserError) {
          // Tratar diferentes tipos de erro
          if (createUserError.message.includes('duplicate') || 
              createUserError.message.includes('already registered') ||
              createUserError.message.includes('user_already_exists')) {
            
            await supabase.from('logs').insert({
              level: 'warning',
              context: 'user-management-duplicate-detected',
              message: 'Duplicate user detected during creation, fetching existing user',
              metadata: { 
                email: payload.email,
                error: createUserError.message,
                attempt: createUserAttempts + 1
              }
            });

            // Tentar buscar o usuário que foi criado por outra transação
            const { data: retryUsers } = await supabase.auth.admin.listUsers({ 
              email: payload.email.toLowerCase().trim()
            });

            if (retryUsers?.users?.length > 0) {
              const retryUser = retryUsers.users[0];
              await supabase.from('logs').insert({
                level: 'info',
                context: 'user-management-retry-success',
                message: 'Found existing user after duplicate error',
                metadata: { 
                  userId: retryUser.id,
                  email: payload.email
                }
              });
              return { id: retryUser.id, isExisting: true };
            }
          }

          throw createUserError;
        }

        if (!createdUser?.user) {
          throw new Error('Erro desconhecido: usuário não criado');
        }

        newUser = createdUser.user;
        break; // Sucesso, sair do loop

      } catch (createError: any) {
        createUserAttempts++;
        
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'user-management-create-attempt',
          message: `User creation attempt ${createUserAttempts} failed`,
          metadata: { 
            email: payload.email,
            error: createError.message,
            attempt: createUserAttempts
          }
        });

        if (createUserAttempts >= maxAttempts) {
          throw new Error(`Falha ao criar usuário após ${maxAttempts} tentativas: ${createError.message}`);
        }

        // Esperar um pouco antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, createUserAttempts)));
      }
    }

    // Importante: NÃO criamos o perfil aqui - apenas retornamos o ID do usuário
    // O perfil será criado apenas após o pagamento bem-sucedido
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-auth-created',
      message: 'Auth user created successfully, profile will be created after payment',
      metadata: { 
        userId: newUser.id,
        email: payload.email
      }
    });

    return { id: newUser.id, isExisting: false };
  }
}

// Nova função para criar ou atualizar o perfil do usuário após pagamento bem-sucedido
export async function createOrUpdateUserProfile(
  userId: string, 
  payload: RequestPayload, 
  isExistingUser: boolean,
  supabase: any
): Promise<void> {
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-profile-creation-start',
    message: isExistingUser ? 'Updating existing user profile after payment' : 'Creating new user profile after payment',
    metadata: { 
      userId,
      email: payload.email,
      isExistingUser
    }
  });

  try {
    if (isExistingUser) {
      // Atualizar perfil existente
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          name: payload.name,
          cpf: payload.cpf,
          email: payload.email.toLowerCase().trim(),
          whatsapp: payload.whatsapp,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-profile-update-error',
          message: 'Failed to update existing user profile after payment',
          metadata: { 
            userId,
            error: updateError.message,
            errorCode: updateError.code
          }
        });
        throw new Error(`Erro ao atualizar perfil do usuário: ${updateError.message}`);
      }
    } else {
      // Criar novo perfil
      const { error: insertError } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          name: payload.name,
          cpf: payload.cpf,
          email: payload.email.toLowerCase().trim(),
          whatsapp: payload.whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString()
        });

      if (insertError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-profile-creation-error',
          message: 'Failed to create new user profile after payment',
          metadata: { 
            userId,
            error: insertError.message,
            errorCode: insertError.code
          }
        });
        throw new Error(`Erro ao criar perfil do usuário: ${insertError.message}`);
      }
    }

    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-profile-success',
      message: isExistingUser ? 'User profile updated successfully after payment' : 'User profile created successfully after payment',
      metadata: { 
        userId,
        email: payload.email
      }
    });
  } catch (error: any) {
    // Logar o erro, mas não interromper o fluxo - o pagamento já foi processado
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-profile-unhandled-error',
      message: `Unhandled error in profile creation/update: ${error.message}`,
      metadata: { 
        userId,
        email: payload.email,
        errorStack: error.stack
      }
    });
    // Não relançamos o erro para não interromper o fluxo principal
  }
}
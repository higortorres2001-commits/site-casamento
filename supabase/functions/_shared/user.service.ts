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

  // ESTRATÉGIA 1: Buscar usuário existente com tratamento de concorrência
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
        existingUserCreated: existingUser.created_at,
        existingUserLastSignIn: existingUser.last_sign_in_at
      }
    });

    // ESTRATÉGIA 2: Usar UPSERT para perfil (atualiza ou cria sem conflitos)
    const { error: upsertProfileError } = await supabase
      .from('profiles')
      .upsert({
        id: existingUser.id,
        name: payload.name, 
        cpf: payload.cpf, 
        email: payload.email, 
        whatsapp: payload.whatsapp,
        updated_at: new Date().toISOString()
        // Não sobrescrever campos importantes se já existirem
      }, {
        onConflict: 'id', // Se houver conflito no ID, atualiza
        ignoreDuplicates: false // Não ignorar duplicatas, tratar conflitos
      })
      .select()
      .single();

    if (upsertProfileError) {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-upsert-error',
        message: 'Failed to upsert existing user profile, but continuing with payment',
        metadata: { 
          userId: existingUser.id,
          error: upsertProfileError.message,
          errorCode: upsertProfileError.code
        }
      });
      // Não falhar o processo - continuar com o pagamento
    } else {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-upserted',
        message: 'Existing user profile upserted successfully',
        metadata: { userId: existingUser.id }
      });
    }

    return { id: existingUser.id, isExisting: true };
  } else {
    // ESTRATÉGIA 3: Criar novo usuário com tratamento de erro específico
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-creating-new',
      message: 'Creating new user account',
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
          email: payload.email,
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
              email: payload.email 
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

    // ESTRATÉGIA 4: Criar perfil para o novo usuário com UPSERT
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: newUser.id,
        name: payload.name,
        cpf: payload.cpf,
        email: payload.email,
        whatsapp: payload.whatsapp,
        access: [],
        primeiro_acesso: true,
        has_changed_password: false,
        is_admin: false,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })
      .select()
      .single();

    if (profileError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-profile-creation-error',
        message: 'Failed to create profile for new user, but user account was created',
        metadata: { 
          userId: newUser.id,
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
        metadata: { userId: newUser.id }
      });
    }

    return { id: newUser.id, isExisting: false };
  }
}
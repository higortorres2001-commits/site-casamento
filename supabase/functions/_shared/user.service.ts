import { RequestPayload, UserData } from './types.ts';

// Função para gerenciar usuário (existente ou novo) com tratamento de concorrência aprimorado
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

  // ETAPA 1: Validação rigorosa dos dados de entrada
  if (!payload.email || !payload.cpf || !payload.name || !payload.whatsapp) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-validation',
      message: 'Missing required fields in payload',
      metadata: { 
        hasEmail: !!payload.email,
        hasCpf: !!payload.cpf,
        hasName: !!payload.name,
        hasWhatsapp: !!payload.whatsapp
      }
    });
    throw new Error('Dados obrigatórios ausentes: email, cpf, nome e whatsapp são necessários');
  }

  const cleanCpf = payload.cpf.replace(/[^\d]+/g, '');
  const cleanEmail = payload.email.toLowerCase().trim();

  if (cleanCpf.length !== 11) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-validation',
      message: 'Invalid CPF format',
      metadata: { 
        originalCpf: payload.cpf,
        cleanCpf,
        cleanCpfLength: cleanCpf.length
      }
    });
    throw new Error('CPF inválido: deve conter 11 dígitos');
  }

  // ETAPA 2: Verificação ATÔMICA de usuário existente por email E CPF
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-duplicate-check',
    message: 'Checking for existing user by email and CPF',
    metadata: { 
      email: cleanEmail,
      cpf: cleanCpf
    }
  });

  // Buscar usuário por EMAIL primeiro (mais comum)
  const { data: authUsersByEmail, error: listUsersByEmailError } = await supabase.auth.admin.listUsers();
  
  if (listUsersByEmailError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-lookup-error',
      message: 'Failed to check for existing user by email',
      metadata: { 
        email: cleanEmail,
        error: listUsersByEmailError.message,
        errorType: listUsersByEmailError.name
      }
    });
    throw new Error('Erro ao verificar usuário existente por email: ' + listUsersByEmailError.message);
  }

  const existingUserByEmail = authUsersByEmail.users.find(u => u.email?.toLowerCase() === cleanEmail);

  // Buscar perfil por CPF para verificar conflitos
  const { data: profileByCpf, error: profileByCpfError } = await supabase
    .from('profiles')
    .select('id, email, name, cpf')
    .eq('cpf', cleanCpf)
    .maybeSingle();

  if (profileByCpfError && profileByCpfError.code !== 'PGRST116') {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-check-error',
      message: 'Error checking CPF in profiles',
      metadata: { 
        cleanCpf,
        error: profileByCpfError.message,
        errorCode: profileByCpfError.code
      }
    });
    // Não falhar ainda - continuar com verificação por email
  }

  // CASO CRÍTICO 1: CPF já existe mas com email diferente
  if (profileByCpf && profileByCpf.email !== cleanEmail) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-email-mismatch',
      message: 'CPF conflict detected - same CPF with different email',
      metadata: { 
        requestedEmail: cleanEmail,
        existingEmail: profileByCpf.email,
        existingUserId: profileByCpf.id,
        cpf: cleanCpf
      }
    });
    throw new Error(`CPF já cadastrado com outro email: ${profileByCpf.email}. Não é possível criar conta com este CPF.`);
  }

  // CASO CRÍTICO 2: Email existe mas CPF não corresponde
  if (existingUserByEmail && profileByCpf && profileByCpf.id !== existingUserByEmail.id) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-id-mismatch',
      message: 'Critical ID mismatch between auth and profile',
      metadata: { 
        authUserId: existingUserByEmail.id,
        profileUserId: profileByCpf.id,
        email: cleanEmail,
        cpf: cleanCpf
      }
    });
    throw new Error('Conflito crítico: usuário existe no auth mas profile vinculado a outro ID. Contate o suporte.');
  }

  // USUÁRIO EXISTENTE: Email e CPF batem
  if (existingUserByEmail) {
    await supabase.from('logs').insert({
      level: 'info',
      context: 'user-management-existing-found',
      message: 'Existing user found, updating profile',
      metadata: { 
        userId: existingUserByEmail.id,
        email: cleanEmail,
        existingUserCreated: existingUserByEmail.created_at,
        existingUserLastSignIn: existingUserByEmail.last_sign_in_at
      }
    });

    // ATUALIZAÇÃO SEGURA DO PERFIL - apenas se não existir ou se for o mesmo usuário
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id, cpf, email')
      .eq('id', existingUserByEmail.id)
      .maybeSingle();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-profile-check-error',
        message: 'Error checking existing profile, attempting upsert',
        metadata: { 
          userId: existingUserByEmail.id,
          error: profileCheckError.message,
          errorCode: profileCheckError.code
        }
      });
    }

    // Se o perfil não existe OU se existe e pertence ao mesmo usuário, fazer upsert
    if (!existingProfile || existingProfile.id === existingUserByEmail.id) {
      const { error: upsertProfileError } = await supabase
        .from('profiles')
        .upsert({
          id: existingUserByEmail.id,
          name: payload.name, 
          cpf: cleanCpf, 
          email: cleanEmail, 
          whatsapp: payload.whatsapp.replace(/\D/g, ''),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id',
          ignoreDuplicates: false
        });

      if (upsertProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'user-management-profile-upsert-error',
          message: 'CRITICAL: Failed to upsert user profile',
          metadata: { 
            userId: existingUserByEmail.id,
            error: upsertProfileError.message,
            errorCode: upsertProfileError.code,
            errorDetails: upsertProfileError.details
          }
        });
        throw new Error('Erro crítico ao atualizar perfil do usuário: ' + upsertProfileError.message);
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-management-profile-upserted',
        message: 'Existing user profile upserted successfully',
        metadata: { userId: existingUserByEmail.id }
      });
    } else {
      // CASO CRÍTICO: Perfil existe mas com ID diferente - isso NÃO deveria acontecer
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-profile-id-mismatch',
        message: 'CRITICAL: Profile exists but with different ID than auth user',
        metadata: { 
          authUserId: existingUserByEmail.id,
          profileId: existingProfile.id,
          email: cleanEmail
        }
      });
      throw new Error('Conflito crítico de IDs entre auth e profile. Contate o suporte.');
    }

    return { id: existingUserByEmail.id, isExisting: true };
  }

  // NOVO USUÁRIO: Verificar se não há conflitos de CPF
  if (profileByCpf) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-cpf-conflict',
      message: 'CPF already registered but no matching auth user found',
      metadata: { 
        requestedEmail: cleanEmail,
        existingProfileEmail: profileByCpf.email,
        existingProfileId: profileByCpf.id,
        cpf: cleanCpf
      }
    });
    throw new Error(`CPF já cadastrado no sistema com o email: ${profileByCpf.email}. Não é possível criar nova conta.`);
  }

  // ETAPA 3: Criar novo usuário com validações adicionais
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-creating-new',
    message: 'Creating new user account with validations',
    metadata: { 
      email: cleanEmail,
      cpfLength: cleanCpf.length,
      timestamp: new Date().toISOString()
    }
  });

  let newUser;
  let createUserAttempts = 0;
  const maxAttempts = 3;

  while (createUserAttempts < maxAttempts) {
    try {
      // VERIFICAÇÃO FINAL ANTES DA CRIAÇÃO (double-check)
      const { data: finalAuthCheck } = await supabase.auth.admin.listUsers();
      const finalExistingUser = finalAuthCheck.users.find(u => u.email?.toLowerCase() === cleanEmail);
      
      if (finalExistingUser) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'user-management-race-condition',
          message: 'User created by another process during creation attempt',
          metadata: { 
            email: cleanEmail,
            existingUserId: finalExistingUser.id,
            attempt: createUserAttempts + 1
          }
        });
        return { id: finalExistingUser.id, isExisting: true };
      }

      const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: cleanEmail,
        password: cleanCpf, // Senha inicial = CPF
        email_confirm: true,
        user_metadata: { 
          name: payload.name, 
          cpf: cleanCpf, 
          whatsapp: payload.whatsapp.replace(/\D/g, ''),
          created_via: 'checkout',
          created_at: new Date().toISOString()
        },
      });

      if (createUserError) {
        // Tratamento específico para conflitos
        if (createUserError.message.includes('duplicate') || 
            createUserError.message.includes('already registered') ||
            createUserError.message.includes('user_already_exists')) {
          
          await supabase.from('logs').insert({
            level: 'warning',
            context: 'user-management-duplicate-detected',
            message: 'Duplicate user detected during creation, fetching existing user',
            metadata: { 
              email: cleanEmail,
              error: createUserError.message,
              attempt: createUserAttempts + 1
            }
          });

          // Buscar o usuário que foi criado
          const { data: retryUsers } = await supabase.auth.admin.listUsers();
          const retryUser = retryUsers.users.find(u => u.email?.toLowerCase() === cleanEmail);
          
          if (retryUser) {
            await supabase.from('logs').insert({
              level: 'info',
              context: 'user-management-retry-success',
              message: 'Found existing user after duplicate error',
              metadata: { 
                userId: retryUser.id,
                email: cleanEmail
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
          email: cleanEmail,
          error: createError.message,
          attempt: createUserAttempts
        }
      });

      if (createUserAttempts >= maxAttempts) {
        throw new Error(`Falha ao criar usuário após ${maxAttempts} tentativas: ${createError.message}`);
      }

      // Esperar antes de tentar novamente (backoff exponencial)
      await new Promise(resolve => setTimeout(resolve, 200 * Math.pow(2, createUserAttempts)));
    }
  }

  if (!newUser) {
    throw new Error('Falha crítica: usuário não criado após todas as tentativas');
  }

  // ETAPA 4: Criar perfil com verificação final
  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-profile-creation',
    message: 'Creating profile for new user with final validation',
    metadata: { userId: newUser.id }
  });

  // VERIFICAÇÃO FINAL: garantir que não há perfil com este ID ou CPF
  const { data: finalProfileCheck, error: finalProfileCheckError } = await supabase
    .from('profiles')
    .select('id, cpf')
    .or(`id.eq.${newUser.id},cpf.eq.${cleanCpf}`);

  if (finalProfileCheckError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-final-profile-check-error',
      message: 'Error in final profile validation',
      metadata: { 
        userId: newUser.id,
        error: finalProfileCheckError.message
      }
    });
    // Continuar mesmo com erro - tentar criar o perfil
  }

  if (finalProfileCheck && finalProfileCheck.length > 0) {
    const conflictingProfile = finalProfileCheck.find(p => p.id !== newUser.id);
    if (conflictingProfile) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-final-conflict',
        message: 'CRITICAL: Profile conflict detected after user creation',
        metadata: { 
          newUserId: newUser.id,
          conflictingProfileId: conflictingProfile.id,
          conflictingCpf: conflictingProfile.cpf
        }
      });
      throw new Error('Conflito crítico detectado após criação do usuário. Contate o suporte.');
    }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: newUser.id,
      name: payload.name,
      cpf: cleanCpf,
      email: cleanEmail,
      whatsapp: payload.whatsapp.replace(/\D/g, ''),
      access: [],
      primeiro_acesso: true,
      has_changed_password: false,
      is_admin: false,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (profileError) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'user-management-profile-creation-error',
      message: 'CRITICAL: Failed to create profile for new user',
      metadata: { 
        userId: newUser.id,
        error: profileError.message,
        errorCode: profileError.code,
        errorDetails: profileError.details
      }
    });
    
    // Tentar deletar o usuário auth criado para evitar inconsistência
    try {
      await supabase.auth.admin.deleteUser(newUser.id);
      await supabase.from('logs').insert({
        level: 'warning',
        context: 'user-management-cleanup',
        message: 'Deleted auth user due to profile creation failure',
        metadata: { userId: newUser.id }
      });
    } catch (deleteError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-management-cleanup-error',
        message: 'Failed to cleanup auth user after profile creation failure',
        metadata: { 
          userId: newUser.id,
          error: deleteError.message
        }
      });
    }
    
    throw new Error('Erro crítico ao criar perfil do usuário: ' + profileError.message);
  }

  await supabase.from('logs').insert({
    level: 'info',
    context: 'user-management-profile-created',
    message: 'Profile created successfully for new user',
    metadata: { userId: newUser.id }
  });

  return { id: newUser.id, isExisting: false };
}
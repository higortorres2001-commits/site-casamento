import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

interface CustomerData {
  email: string;
  name: string;
  cpf: string;
  whatsapp: string;
}

interface CustomerResult {
  userId: string;
  isExisting: boolean;
}

export async function getOrCreateCustomer(
  supabase: any,
  customerData: CustomerData
): Promise<CustomerResult> {
  const { email, name, cpf, whatsapp } = customerData;
  
  await supabase.from('logs').insert({
    level: 'info',
    context: 'get-or-create-customer-start',
    message: 'Starting customer management process',
    metadata: { 
      email: email.toLowerCase().trim(),
      cpfLength: cpf.length,
      hasName: !!name,
      hasWhatsapp: !!whatsapp
    }
  });

  try {
    // ETAPA 1: Verificar se usuário já existe
    await supabase.from('logs').insert({
      level: 'info',
      context: 'get-or-create-customer-lookup',
      message: 'Checking for existing user',
      metadata: { email: email.toLowerCase().trim() }
    });

    const { data: existingUsers, error: listUsersError } = await supabase.auth.admin.listUsers({ 
      email: email.toLowerCase().trim()
    });

    if (listUsersError) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'get-or-create-customer-lookup-error',
        message: 'Failed to check for existing user',
        metadata: { 
          email: email.toLowerCase().trim(),
          error: listUsersError.message,
          errorType: listUsersError.name,
          errorCode: listUsersError.code
        }
      });
      throw new Error('Erro ao verificar usuário existente: ' + listUsersError.message);
    }

    const existingUser = existingUsers.users && existingUsers.users.length > 0 ? existingUsers.users[0] : null;

    if (existingUser) {
      // USUÁRIO EXISTENTE - Atualizar perfil
      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-existing-found',
        message: 'Existing user found, updating profile',
        metadata: { 
          userId: existingUser.id,
          email: email.toLowerCase().trim(),
          existingUserCreated: existingUser.created_at,
          existingUserLastSignIn: existingUser.last_sign_in_at
        }
      });

      // Atualizar perfil do usuário existente com novos dados
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ 
          name: name.trim(), 
          cpf: cpf.replace(/[^0-9]/g, ''), 
          email: email.toLowerCase().trim(), 
          whatsapp: whatsapp.replace(/\D/g, ''),
          updated_at: new Date().toISOString()
        })
        .eq('id', existingUser.id);

      if (updateProfileError) {
        await supabase.from('logs').insert({
          level: 'warning',
          context: 'get-or-create-customer-profile-update-error',
          message: 'Failed to update existing user profile, but continuing with process',
          metadata: { 
            userId: existingUser.id,
            email: email.toLowerCase().trim(),
            error: updateProfileError.message,
            errorCode: updateProfileError.code,
            errorType: updateProfileError.name
          }
        });
        // Não falhar o processo - continuar mesmo se não conseguir atualizar o perfil
        console.warn('Profile update failed but continuing:', updateProfileError);
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'get-or-create-customer-profile-updated',
          message: 'Existing user profile updated successfully',
          metadata: { 
            userId: existingUser.id,
            email: email.toLowerCase().trim(),
            updatedFields: ['name', 'cpf', 'whatsapp', 'updated_at']
          }
        });
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-existing-success',
        message: 'Existing customer processed successfully',
        metadata: { 
          userId: existingUser.id,
          email: email.toLowerCase().trim()
        }
      });

      return { userId: existingUser.id, isExisting: true };

    } else {
      // USUÁRIO NOVO - Criar conta e perfil
      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-creating-new',
        message: 'No existing user found, creating new user account',
        metadata: { 
          email: email.toLowerCase().trim(),
          cpfLength: cpf.length,
          nameLength: name.length
        }
      });

      // ETAPA 2A: Criar usuário no sistema de autenticação
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: email.toLowerCase().trim(),
        password: cpf.replace(/[^0-9]/g, ''), // CPF limpo como senha inicial
        email_confirm: true, // Confirmar email automaticamente
        user_metadata: { 
          name: name.trim(), 
          cpf: cpf.replace(/[^0-9]/g, ''), 
          whatsapp: whatsapp.replace(/\D/g, ''),
          created_via: 'checkout'
        },
      });

      if (createUserError || !newUser?.user) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'get-or-create-customer-auth-creation-error',
          message: 'Failed to create new user account in auth system',
          metadata: { 
            email: email.toLowerCase().trim(),
            error: createUserError?.message,
            errorType: createUserError?.name,
            errorCode: createUserError?.code,
            cpfLength: cpf.length
          }
        });
        throw new Error('Erro ao criar conta de usuário: ' + (createUserError?.message || 'Erro desconhecido na criação da conta'));
      }

      const newUserId = newUser.user.id;

      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-auth-created',
        message: 'New user account created successfully in auth system',
        metadata: { 
          userId: newUserId,
          email: email.toLowerCase().trim(),
          userCreatedAt: newUser.user.created_at
        }
      });

      // ETAPA 2B: Criar perfil para o novo usuário
      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-profile-creation-start',
        message: 'Creating profile for new user',
        metadata: { 
          userId: newUserId,
          email: email.toLowerCase().trim()
        }
      });

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          name: name.trim(),
          cpf: cpf.replace(/[^0-9]/g, ''),
          email: email.toLowerCase().trim(),
          whatsapp: whatsapp.replace(/\D/g, ''),
          access: [], // Array vazio inicialmente
          primeiro_acesso: true, // Primeiro acesso
          has_changed_password: false, // Ainda não mudou a senha
          is_admin: false, // Não é admin
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'get-or-create-customer-profile-creation-error',
          message: 'Failed to create profile for new user',
          metadata: { 
            userId: newUserId,
            email: email.toLowerCase().trim(),
            error: profileError.message,
            errorCode: profileError.code,
            errorType: profileError.name
          }
        });
        
        // Tentar deletar o usuário criado no auth para manter consistência
        try {
          await supabase.auth.admin.deleteUser(newUserId);
          await supabase.from('logs').insert({
            level: 'info',
            context: 'get-or-create-customer-cleanup',
            message: 'Deleted auth user after profile creation failure',
            metadata: { userId: newUserId, email: email.toLowerCase().trim() }
          });
        } catch (cleanupError: any) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'get-or-create-customer-cleanup-error',
            message: 'Failed to cleanup auth user after profile creation failure',
            metadata: { 
              userId: newUserId, 
              email: email.toLowerCase().trim(),
              cleanupError: cleanupError.message 
            }
          });
        }
        
        throw new Error('Erro ao criar perfil do usuário: ' + profileError.message);
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-profile-created',
        message: 'Profile created successfully for new user',
        metadata: { 
          userId: newUserId,
          email: email.toLowerCase().trim()
        }
      });

      await supabase.from('logs').insert({
        level: 'info',
        context: 'get-or-create-customer-new-success',
        message: 'New customer created successfully',
        metadata: { 
          userId: newUserId,
          email: email.toLowerCase().trim(),
          cpfLength: cpf.length
        }
      });

      return { userId: newUserId, isExisting: false };
    }

  } catch (error: any) {
    await supabase.from('logs').insert({
      level: 'error',
      context: 'get-or-create-customer-unhandled-error',
      message: 'Unhandled error in getOrCreateCustomer function',
      metadata: {
        email: email.toLowerCase().trim(),
        errorMessage: error.message,
        errorStack: error.stack,
        cpfLength: cpf.length
      }
    });
    
    // Re-throw para que a função principal possa tratar
    throw error;
  }
}
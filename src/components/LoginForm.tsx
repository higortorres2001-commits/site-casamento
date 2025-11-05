"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Link, useNavigate } from "react-router-dom";

const formSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    
    try {
      // ETAPA 1: Log do início da tentativa de login
      await supabase.from('logs').insert({
        level: 'info',
        context: 'login-attempt-start',
        message: 'User attempting to login',
        metadata: { 
          email: data.email.toLowerCase().trim(),
          passwordLength: data.password.length,
          passwordContainsDots: data.password.includes('.'),
          passwordContainsDash: data.password.includes('-'),
          passwordIsNumeric: /^\d+$/.test(data.password.replace(/[^\d]/g, ''))
        }
      });

      // Remove qualquer formatação da senha (caso o usuário digite o CPF formatado)
      let cleanPassword = data.password;
      let passwordType = 'as_typed';
      
      // Verifica se parece ser um CPF formatado e remove a formatação
      if (data.password.includes('.') || data.password.includes('-')) {
        cleanPassword = data.password.replace(/[^\d]/g, '');
        passwordType = 'formatted_cpf';
        console.log('CPF formatado detectado, removendo formatação:', data.password, '->', cleanPassword);
      } else if (/^\d+$/.test(data.password)) {
        passwordType = 'numeric_cpf';
      }

      // ETAPA 2: Tentativa de login
      const { error, data: sessionData } = await supabase.auth.signInWithPassword({
        email: data.email.toLowerCase().trim(),
        password: cleanPassword, // Usa a senha limpa (apenas números se for CPF)
      });

      if (error) {
        // ETAPA 3: Log de erro de login
        await supabase.from('logs').insert({
          level: 'error',
          context: 'login-attempt-failed',
          message: 'Login authentication failed',
          metadata: { 
            email: data.email.toLowerCase().trim(), 
            originalPassword: data.password,
            cleanPassword: cleanPassword,
            passwordLength: cleanPassword.length,
            passwordType: passwordType,
            errorType: error.name, 
            errorMessage: error.message,
            errorDetails: {
              hasInvalidCredentials: error.message.includes('Invalid login credentials'),
              hasEmailNotConfirmed: error.message.includes('Email not confirmed'),
              hasOtherError: !error.message.includes('Invalid login credentials') && !error.message.includes('Email not confirmed')
            }
          }
        });

        // Mensagens de erro mais específicas
        if (error.message.includes('Invalid login credentials')) {
          showError("Email ou senha incorretos. Se é seu primeiro acesso, use apenas os números do seu CPF (sem pontos ou traços).");
        } else if (error.message.includes('Email not confirmed')) {
          showError("Por favor, confirme seu email antes de fazer login.");
        } else {
          showError("Erro ao fazer login. Tente novamente.");
        }
        return;
      }

      // ETAPA 4: Login bem-sucedido - verificar perfil
      await supabase.from('logs').insert({
        level: 'info',
        context: 'login-auth-success',
        message: 'User authenticated successfully',
        metadata: { 
          userId: sessionData.user.id, 
          email: sessionData.user.email,
          passwordType: passwordType,
          authProvider: 'email'
        }
      });

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, has_changed_password, primeiro_acesso, is_admin')
        .eq('id', sessionData.user.id)
        .single();

      if (profileError || !profile) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'login-profile-error',
          message: 'User profile not found after successful auth',
          metadata: { 
            userId: sessionData.user.id,
            email: sessionData.user.email,
            profileError: profileError?.message,
            errorType: profileError?.name
          }
        });
        showError("Perfil do usuário não encontrado.");
        await supabase.auth.signOut();
        return;
      }

      // ETAPA 5: Verificar se precisa trocar senha
      if (!profile.has_changed_password) {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'login-redirect-password-change',
          message: 'Redirecting user to first password change',
          metadata: { 
            userId: sessionData.user.id,
            email: sessionData.user.email,
            primeiro_acesso: profile.primeiro_acesso,
            is_admin: profile.is_admin
          }
        });
        navigate("/primeira-senha");
        return;
      }

      // ETAPA 6: Login completo com sucesso
      await supabase.from('logs').insert({
        level: 'info',
        context: 'login-success-complete',
        message: 'User login process completed successfully',
        metadata: { 
          userId: sessionData.user.id, 
          email: sessionData.user.email,
          passwordType: passwordType,
          has_changed_password: profile.has_changed_password,
          is_admin: profile.is_admin
        }
      });

      showSuccess("Login realizado com sucesso!");
      navigate("/meus-produtos");
    } catch (err: any) {
      // ETAPA 7: Log de erro não tratado
      await supabase.from('logs').insert({
        level: 'error',
        context: 'login-unhandled-error',
        message: 'Unhandled error during login process',
        metadata: { 
          email: data.email.toLowerCase().trim(),
          error: err.message,
          errorStack: err.stack,
          errorType: err.name
        }
      });
      showError("Erro inesperado. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      showError("Por favor, insira um email válido para recuperar a senha.");
      return;
    }

    setIsResetting(true);
    
    try {
      await supabase.from('logs').insert({
        level: 'info',
        context: 'forgot-password-start',
        message: 'User requested password reset',
        metadata: { 
          email: email.toLowerCase().trim()
        }
      });

      const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase().trim(), {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'forgot-password-error',
          message: 'Failed to send password reset email',
          metadata: { 
            email: email.toLowerCase().trim(),
            error: error.message,
            errorType: error.name
          }
        });
        showError("Erro ao solicitar recuperação de senha: " + error.message);
        console.error("Forgot password error:", error);
      } else {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'forgot-password-success',
          message: 'Password reset email sent successfully',
          metadata: { 
            email: email.toLowerCase().trim()
          }
        });
        showSuccess("Um link de recuperação de senha foi enviado para o seu email. Verifique sua caixa de entrada e a pasta de spam.");
      }
    } catch (err: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'forgot-password-unhandled',
        message: 'Unhandled error during password reset request',
        metadata: { 
          email: email.toLowerCase().trim(),
          error: err.message,
          errorStack: err.stack
        }
      });
      showError("Erro inesperado ao solicitar recuperação de senha.");
      console.error("Unexpected forgot password error:", err);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="text-center">
          <p className="text-lg text-gray-700 mb-2">Bem-vindo! Use o e-mail da sua compra para entrar.</p>
          <p className="text-sm text-gray-600 mb-6">
            <strong>Primeiro acesso?</strong> Sua senha são apenas os <strong>números do seu CPF</strong> (sem pontos ou traços).
            <br />
            <span className="text-xs text-gray-500">Exemplo: se seu CPF é 123.456.789-00, use 12345678900</span>
          </p>
        </div>

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input
                  placeholder="seu@email.com"
                  {...field}
                  className="focus:ring-orange-500 focus:border-orange-500"
                  type="email"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Senha</FormLabel>
              <FormControl>
                <Input
                  placeholder="Digite sua senha (CPF sem formatação no primeiro acesso)"
                  {...field}
                  className="focus:ring-orange-500 focus:border-orange-500"
                  type="password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
          disabled={isLoading || isResetting}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
        </Button>

        <div className="text-center mt-4 space-y-2">
          <Button 
            variant="link" 
            onClick={handleForgotPassword} 
            disabled={isResetting || isLoading}
            className="text-blue-600 hover:text-blue-800 text-sm"
          >
            {isResetting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Envando email de recuperação...
              </>
            ) : (
              "Esqueci minha senha"
            )}
          </Button>
          
          <div className="text-xs text-gray-500 mt-2">
            <p>Dicas para recuperação de senha:</p>
            <ul className="text-left mt-1 space-y-1">
              <li>• Verifique sua caixa de entrada</li>
              <li>• Verifique a pasta de spam/li>
              <li>• Aguarde alguns minutos para receber o email</li>
              <li>• O link de recuperação expira em 24 horas</li>
            </ul>
          </div>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;
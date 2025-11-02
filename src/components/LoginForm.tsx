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
      // Remove qualquer formatação da senha (caso o usuário digite o CPF formatado)
      const cleanPassword = data.password.replace(/\D/g, '');
      
      const { error, data: sessionData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: cleanPassword, // Usa a senha limpa (apenas números)
      });

      if (error) {
        console.error("Login error details:", error);
        
        // Adicionar logs mais detalhados para diagnóstico
        await supabase.from('logs').insert({
          level: 'error',
          context: 'login-attempt',
          message: 'Login failed',
          metadata: { 
            email: data.email, 
            errorType: error.name, 
            errorMessage: error.message,
            passwordLength: cleanPassword.length
          }
        });

        // Mensagens de erro mais específicas
        if (error.message.includes('Invalid login credentials')) {
          showError("Email ou senha incorretos. Se é seu primeiro acesso, use apenas os números do seu CPF como senha (sem pontos ou traços).");
        } else if (error.message.includes('Email not confirmed')) {
          showError("Por favor, confirme seu email antes de fazer login.");
        } else {
          showError("Erro ao fazer login. Tente novamente.");
        }
        return;
      }

      // Verificar se o usuário existe no perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, has_changed_password')
        .eq('id', sessionData.user.id)
        .single();

      if (profileError || !profile) {
        showError("Perfil do usuário não encontrado.");
        await supabase.auth.signOut();
        return;
      }

      // Se nunca trocou a senha, redirecionar para troca
      if (!profile.has_changed_password) {
        navigate("/primeira-senha");
        return;
      }

      // Log de login bem-sucedido
      await supabase.from('logs').insert({
        level: 'info',
        context: 'login-success',
        message: 'User logged in successfully',
        metadata: { 
          userId: sessionData.user.id, 
          email: sessionData.user.email 
        }
      });

      showSuccess("Login realizado com sucesso!");
      navigate("/meus-produtos");
    } catch (err: any) {
      console.error("Unexpected login error:", err);
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

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        showError("Erro ao solicitar recuperação de senha: " + error.message);
        console.error("Forgot password error:", error);
      } else {
        showSuccess("Um link de recuperação de senha foi enviado para o seu email.");
      }
    } catch (err: any) {
      showError("Erro inesperado ao solicitar recuperação de senha.");
      console.error("Unexpected forgot password error:", err);
    } finally {
      setIsLoading(false);
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
                  placeholder="Apenas números do CPF no primeiro acesso"
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
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Entrar"}
        </Button>

        <div className="text-center mt-2">
          <Button variant="link" onClick={handleForgotPassword} disabled={isLoading} className="text-blue-600 hover:text-blue-800">
            Esqueci minha senha
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;
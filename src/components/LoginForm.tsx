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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { sendPasswordResetEmail } from "@/utils/email";
import { Link, useNavigate } from "react-router-dom";

const formSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
      const { error, data: sessionData } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        console.error("Login error details:", error);
        
        await supabase.from('logs').insert({
          level: 'error',
          context: 'login-attempt',
          message: 'Login failed',
          metadata: { 
            email: data.email, 
            errorType: error.name, 
            errorMessage: error.message,
          }
        });

        if (error.message.includes('Invalid login credentials')) {
          showError("Email ou senha incorretos. Se é seu primeiro acesso, use a senha padrão informada no email de confirmação.");
        } else if (error.message.includes('Email not confirmed')) {
          showError("Por favor, confirme seu email antes de fazer login.");
        } else {
          showError("Erro ao fazer login. Tente novamente.");
        }
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
        // Enviar e-mail de redefinição de senha
        const resetLink = `${window.location.origin}/update-password`;
        const emailResult = await sendPasswordResetEmail({ 
          to: email, 
          resetLink 
        });

        if (emailResult.success) {
          showSuccess("Um link de recuperação de senha foi enviado para o seu email.");
        } else {
          showError("Erro ao enviar e-mail de recuperação de senha.");
        }
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
            <strong>Primeiro acesso?</strong> Use a senha padrão: <strong>Sem@</strong> + 3 primeiros dígitos do seu CPF
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
              <div className="relative">
                <FormControl>
                  <Input
                    placeholder="Sua senha"
                    {...field}
                    className="focus:ring-orange-500 focus:border-orange-500 pr-10"
                    type={showPassword ? "text" : "password"}
                  />
                </FormControl>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
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
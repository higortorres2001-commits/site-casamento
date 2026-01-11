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
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { AUTH_MESSAGES, VALIDATION_MESSAGES } from "@/constants/messages";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEmailExistence } from "@/hooks/use-email-existence";

// Define the form schema type explicitly
const formSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { checkEmailExists, isChecking, emailExists } = useEmailExistence();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'login',
          message: 'Login failed',
          metadata: {
            email: data.email,
            errorType: error.name,
            errorMessage: error.message
          }
        });

        showUserError(AUTH_MESSAGES.error.LOGIN_FAILED, error);
        console.error("Login error:", error);
        return;
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'login',
        message: 'User logged in successfully',
        metadata: { email: data.email }
      });

      showSuccess(AUTH_MESSAGES.success.LOGIN);
      navigate("/dashboard");
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'login',
        message: 'Unexpected login error',
        metadata: {
          email: data.email,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });

      showUserError(AUTH_MESSAGES.error.LOGIN_FAILED, error);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const email = form.getValues("email");

    if (!email || !z.string().email().safeParse(email).success) {
      showError(VALIDATION_MESSAGES.INVALID_EMAIL);
      return;
    }

    setIsResetting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'password-reset',
          message: 'Password reset request failed',
          metadata: {
            email,
            errorType: error.name,
            errorMessage: error.message
          }
        });

        showUserError(AUTH_MESSAGES.error.PASSWORD_RESET_FAILED, error);
        console.error("Password reset error:", error);
        return;
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'password-reset',
        message: 'Password reset email sent successfully',
        metadata: { email }
      });

      showSuccess(AUTH_MESSAGES.success.PASSWORD_RESET_EMAIL);
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'password-reset',
        message: 'Unexpected password reset error',
        metadata: {
          email,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });

      showUserError(AUTH_MESSAGES.error.PASSWORD_RESET_FAILED, error);
      console.error("Unexpected error:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    placeholder="seu@email.com"
                    {...field}
                    type="email"
                    disabled={isLoading}
                    className="focus:ring-pink-500 focus:border-pink-500"
                  />
                  {isChecking && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                  )}
                  {emailExists !== null && !isChecking && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                      {emailExists ? "✓" : ""}
                    </span>
                  )}
                </div>
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
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Sua senha"
                    {...field}
                    disabled={isLoading}
                    className="focus:ring-pink-500 focus:border-pink-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    disabled={isLoading}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-between items-center">
          <Button
            type="button"
            variant="link"
            onClick={handleForgotPassword}
            disabled={isLoading || isResetting}
            className="text-sm text-pink-600 hover:text-pink-700"
          >
            {isResetting ? "Enviando..." : "Esqueci minha senha"}
          </Button>
        </div>

        <Button
          type="submit"
          className="w-full bg-pink-500 hover:bg-pink-600 text-white"
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            "Entrar"
          )}
        </Button>

        <div className="text-center text-sm text-gray-600 mt-4">
          Não tem uma conta?{" "}
          <Link to="/cadastro" className="text-pink-600 hover:text-pink-700 font-medium">
            Criar lista de presentes
          </Link>
        </div>
      </form>
    </Form>
  );
};

export default LoginForm;
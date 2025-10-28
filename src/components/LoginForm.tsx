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
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error) {
      showError("Erro ao fazer login: " + error.message);
      console.error("Login error:", error);
    } else {
      showSuccess("Login realizado com sucesso!");
      navigate("/"); // Redirect to home or dashboard after successful login
    }
    setIsLoading(false);
  };

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      showError("Por favor, insira um email válido para recuperar a senha.");
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`, // You might need a page to handle password reset
    });

    if (error) {
      showError("Erro ao solicitar recuperação de senha: " + error.message);
      console.error("Forgot password error:", error);
    } else {
      showSuccess("Um link de recuperação de senha foi enviado para o seu email.");
    }
    setIsLoading(false);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="text-center">
          {/* Placeholder for your logo */}
          <h1 className="text-4xl font-bold text-gray-800 mb-4">Seu Logo</h1>
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
                  placeholder="Sua senha"
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

        <p className="text-sm text-gray-600 text-center mt-4">
          Primeiro acesso após a compra? Sua senha são os 11 números do seu CPF.
        </p>
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
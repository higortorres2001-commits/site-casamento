"use client";

import React, { useState, useEffect } from "react";
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
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";

const formSchema = z.object({
  newPassword: z.string().min(6, "A nova senha deve ter pelo menos 6 caracteres."),
  confirmPassword: z.string().min(6, "A confirmação da senha deve ter pelo menos 6 caracteres."),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

const UpdatePassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Removido o useEffect que redirecionava para /login, pois esta página agora é pública
  // e deve permitir a redefinição de senha mesmo sem uma sessão ativa persistente.

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    // Para redefinição de senha via link, o 'user' pode ser nulo inicialmente,
    // mas o Supabase gerencia a sessão temporária.
    // Se o usuário estiver logado (primeiro acesso), 'user' estará presente.

    setIsLoading(true);
    try {
      // 1. Update user password in Supabase Auth
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateAuthError) {
        showError("Erro ao atualizar a senha: " + updateAuthError.message);
        console.error("Update password error:", updateAuthError);
        return;
      }

      // 2. Update has_changed_password in profiles table if a user is available
      if (user) {
        const { error: updateProfileError } = await supabase
          .from('profiles')
          .update({ has_changed_password: true })
          .eq('id', user.id);

        if (updateProfileError) {
          showError("Erro ao registrar a troca de senha no perfil: " + updateProfileError.message);
          console.error("Update profile has_changed_password error:", updateProfileError);
          // Even if profile update fails, password is changed, so proceed.
        }
      } else {
        // This case handles password reset via email link where 'user' might be null initially
        // but the password was successfully updated in auth.users.
        // We might need to fetch the user after update or rely on the next session check.
        console.log("Password updated for a user not yet in session context (e.g., password reset link).");
      }

      showSuccess("Senha atualizada com sucesso! Você será redirecionado.");
      navigate("/meus-produtos"); // Redirect to products page after successful update
    } catch (error: any) {
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Se estiver carregando a sessão, mostre um loader
  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-800 mb-2">
            {user?.email ? "Atualize sua Senha" : "Defina sua Nova Senha"}
          </CardTitle>
          <p className="text-md text-gray-600">
            Por segurança, por favor, defina uma nova senha.
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nova Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Sua nova senha"
                        {...field}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        placeholder="Confirme sua nova senha"
                        {...field}
                        className="focus:ring-orange-500 focus:border-orange-500"
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
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Atualizar Senha"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default UpdatePassword;
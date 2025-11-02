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

const formSchema = z.object({
  newPassword: z.string()
    .min(6, "A nova senha deve ter pelo menos 6 caracteres.")
    .regex(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/, 
      "A senha deve conter pelo menos uma letra e um número"),
  confirmPassword: z.string().min(6, "A confirmação da senha deve ter pelo menos 6 caracteres."),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

const ResetPassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Attempt to update the password
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        // Log the error
        await supabase.from('logs').insert({
          level: 'error',
          context: 'reset-password',
          message: 'Failed to reset password',
          metadata: { 
            errorType: error.name, 
            errorMessage: error.message 
          }
        });

        // Show user-friendly error
        showError("Erro ao redefinir a senha: " + error.message);
        console.error("Reset password error:", error);
        return;
      }

      // Log successful password reset
      await supabase.from('logs').insert({
        level: 'info',
        context: 'reset-password',
        message: 'Password successfully reset',
      });

      // Show success message
      showSuccess("Senha redefinida com sucesso!");

      // Redirect to login page
      navigate("/login");
    } catch (error: any) {
      // Log unexpected errors
      await supabase.from('logs').insert({
        level: 'error',
        context: 'reset-password',
        message: 'Unexpected error during password reset',
        metadata: { 
          errorMessage: error.message, 
          errorStack: error.stack 
        }
      });

      // Show user-friendly error
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-800 mb-2">
            Redefinir Senha
          </CardTitle>
          <p className="text-md text-gray-600">
            Digite sua nova senha abaixo
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
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Redefinir Senha"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;
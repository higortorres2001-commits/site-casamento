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
import { Loader2, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { AUTH_MESSAGES } from "@/constants/messages";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";
import PasswordRequirements from "@/components/PasswordRequirements";

const formSchema = z.object({
  newPassword: z.string()
    .refine(
      (password) => {
        const hasMinLength = password.length >= 6;
        const hasLetter = /[a-zA-Z]/.test(password);
        const hasDigit = /\d/.test(password);
        return hasMinLength && hasLetter && hasDigit;
      },
      {
        message: "A senha não atende aos requisitos"
      }
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

const UpdatePassword = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const newPassword = form.watch("newPassword");

  useEffect(() => {
    if (!isSessionLoading && !user) {
      navigate("/login");
    }
  }, [user, isSessionLoading, navigate]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!user) {
      showError(AUTH_MESSAGES.error.NOT_LOGGED_IN);
      navigate("/login");
      return;
    }

    setIsLoading(true);
    try {
      const { error: updateAuthError } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (updateAuthError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'update-password',
          message: 'Failed to update password in auth',
          metadata: {
            userId: user.id,
            errorType: updateAuthError.name,
            errorMessage: updateAuthError.message
          }
        });
        showUserError(AUTH_MESSAGES.error.PASSWORD_UPDATE_FAILED, updateAuthError);
        console.error("Update password error:", updateAuthError);
        return;
      }

      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({
          has_changed_password: true,
          primeiro_acesso: false
        })
        .eq('id', user.id);

      if (updateProfileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'update-password',
          message: 'Failed to update profile after password change',
          metadata: {
            userId: user.id,
            errorType: updateProfileError.name,
            errorMessage: updateProfileError.message
          }
        });
        showUserError(AUTH_MESSAGES.error.PROFILE_SAVE_FAILED, updateProfileError);
        console.error("Update profile has_changed_password error:", updateProfileError);
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'update-password',
        message: 'User successfully updated password',
        metadata: { userId: user.id }
      });

      showSuccess(AUTH_MESSAGES.success.PASSWORD_UPDATED);
      navigate("/meus-produtos");
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'update-password',
        message: 'Unexpected error during password update',
        metadata: {
          userId: user.id,
          errorMessage: error.message,
          errorStack: error.stack
        }
      });
      showUserError(AUTH_MESSAGES.error.PASSWORD_UPDATE_FAILED, error);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSessionLoading || !user) {
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
            Primeiro Acesso: Troque sua Senha
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
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Sua nova senha"
                          {...field}
                          className="focus:ring-orange-500 focus:border-orange-500 pr-10"
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
              <PasswordRequirements password={newPassword} />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Nova Senha</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Confirme sua nova senha"
                          {...field}
                          className="focus:ring-orange-500 focus:border-orange-500 pr-10"
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
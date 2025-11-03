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
import { showError, showSuccess } from "@/utils/toast";
import { sendPasswordChangedEmail } from "@/utils/email";
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
    // Verificar se o usuário está logado
    if (!isSessionLoading && !user) {
      showError("Você precisa estar logado para redefinir a senha.");
      navigate("/login");
    }
  }, [user, isSessionLoading, navigate]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!user) {
      showError("Você precisa estar logado para redefinir a senha.");
      navigate("/login");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'update-password',
          message: 'Failed to update password',
          metadata: { 
            userId: user?.id, 
            errorType: error.name, 
            errorMessage: error.message 
          }
        });
        showError("Erro ao atualizar a senha: " + error.message);
        console.error("Update password error:", error);
        return;
      }

      // Log da troca de senha
      await supabase.from('logs').insert({
        level: 'info',
        context: 'update-password',
        message: 'User successfully updated password',
        metadata: { userId: user.id }
      });

      // Enviar e-mail de senha alterada
      if (user.email) {
        const emailResult = await sendPasswordChangedEmail({ to: user.email });
        if (!emailResult.success) {
          console.error('Falha ao enviar e-mail de senha alterada');
        }
      }

      showSuccess("Senha atualizada com sucesso!");
      navigate("/meus-produtos");
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'update-password',
        message: 'Unexpected error during password update',
        metadata: { 
          userId: user?.id, 
          errorMessage: error.message, 
          errorStack: error.stack 
        }
      });
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Resto do código mantido igual
  // ...
};

export default UpdatePassword;
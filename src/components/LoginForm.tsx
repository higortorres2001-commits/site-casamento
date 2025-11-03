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

  const handleForgotPassword = async () => {
    const email = form.getValues("email");
    if (!email || !z.string().email().safeParse(email).success) {
      showError("Por favor, insira um email válido para recuperar a senha.");
      return;
    }

    setIsLoading(true);
    try {
      // Primeiro, solicitar redefinição de senha no Supabase
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) {
        console.error('Supabase password reset error:', error);
        showError("Erro ao solicitar recuperação de senha: " + error.message);
        return;
      }

      // Enviar e-mail de recuperação
      const resetLink = `${window.location.origin}/update-password`;
      const emailResult = await sendPasswordResetEmail({ 
        to: email, 
        resetLink 
      });

      if (emailResult.success) {
        showSuccess("Um link de recuperação de senha foi enviado para o seu email.");
        
        // Log de tentativa de recuperação de senha
        await supabase.from('logs').insert({
          level: 'info',
          context: 'password-reset-request',
          message: 'Password reset link sent',
          metadata: { email }
        });
      } else {
        console.error('Email sending error:', emailResult.error);
        showError("Erro ao enviar e-mail de recuperação de senha.");
        
        // Log de falha no envio de e-mail
        await supabase.from('logs').insert({
          level: 'error',
          context: 'password-reset-request',
          message: 'Failed to send password reset email',
          metadata: { 
            email, 
            error: JSON.stringify(emailResult.error) 
          }
        });
      }
    } catch (err: any) {
      console.error("Unexpected password reset error:", err);
      showError("Erro inesperado ao solicitar recuperação de senha.");
      
      // Log de erro inesperado
      await supabase.from('logs').insert({
        level: 'error',
        context: 'password-reset-request',
        message: 'Unexpected error during password reset',
        metadata: { 
          email, 
          errorMessage: err.message, 
          errorStack: err.stack 
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Resto do código mantido igual...
};

export default LoginForm;
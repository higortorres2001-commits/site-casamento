"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail, Lock, User } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import AccessCodeModal from "./AccessCodeModal";

const passwordFormSchema = z.object({
  password: z.string().min(1, "A senha é obrigatória"),
});

interface ExistingUserSectionProps {
  email: string;
  onUserAuthenticated: (userData: any) => void;
  onBackToEmail: () => void;
}

const ExistingUserSection = ({ email, onUserAuthenticated, onBackToEmail }: ExistingUserSectionProps) => {
  const [method, setMethod] = useState<"code" | "password" | null>(null);
  const [isAccessCodeModalOpen, setIsAccessCodeModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      password: "",
    },
  });

  const handleSendAccessCode = () => {
    setIsAccessCodeModalOpen(true);
  };

  const handleCodeVerified = (userData: any) => {
    onUserAuthenticated(userData);
  };

  const handlePasswordLogin = async (data: z.infer<typeof passwordFormSchema>) => {
    setIsLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password: data.password,
      });

      if (error) {
        showError("Senha incorreta. Tente novamente ou use o código de acesso.");
        console.error("Password login error:", error);
      } else {
        showSuccess("Login realizado com sucesso!");
        
        // Buscar dados completos do perfil
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, cpf, whatsapp')
          .eq('id', authData.user.id)
          .single();

        const userData = {
          ...authData.user,
          name: profile?.name || "",
          cpf: profile?.cpf || "",
          whatsapp: profile?.whatsapp || "",
          isNewUser: false,
          userId: authData.user.id,
        };
        
        onUserAuthenticated(userData);
      }
    } catch (error: any) {
      showError("Erro ao fazer login: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (method === null) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 space-y-4">
        <div className="flex items-center gap-2 text-green-800">
          <User className="h-5 w-5" />
          <h3 className="text-lg font-semibold">Que bom te ver de volta!</h3>
        </div>
        
        <p className="text-green-700">
          Identificamos sua conta <strong>{email}</strong>. Como você prefere acessar?
        </p>

        <div className="space-y-3">
          <Button
            onClick={() => setMethod("code")}
            className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Receber um código de acesso
          </Button>
          
          <Button
            onClick={() => setMethod("password")}
            variant="outline"
            className="w-full border-green-600 text-green-700 hover:bg-green-50 flex items-center gap-2"
          >
            <Lock className="h-4 w-4" />
            Usar minha senha
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={onBackToEmail}
          className="w-full text-green-600 hover:text-green-800"
        >
          Usar outro e-mail
        </Button>
      </div>
    );
  }

  if (method === "code") {
    return (
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            Enviaremos um código de 6 dígitos para <strong>{email}</strong>.
          </p>
          <Button
            onClick={handleSendAccessCode}
            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Mail className="h-4 w-4 mr-2" />
            Enviar Código por E-mail
          </Button>
        </div>

        <Button
          variant="ghost"
          onClick={() => setMethod(null)}
          className="w-full"
        >
          ← Voltar
        </Button>

        <AccessCodeModal
          isOpen={isAccessCodeModalOpen}
          onClose={() => setIsAccessCodeModalOpen(false)}
          email={email}
          onCodeVerified={handleCodeVerified}
        />
      </div>
    );
  }

  if (method === "password") {
    return (
      <div className="space-y-4">
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <p className="text-sm text-orange-700">
            Digite sua senha para acessar a conta <strong>{email}</strong>.
          </p>
        </div>

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(handlePasswordLogin)} className="space-y-4">
            <FormField
              control={passwordForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Senha</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Digite sua senha"
                      {...field}
                      disabled={isLoading}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </Form>

        <Button
          variant="ghost"
          onClick={() => setMethod(null)}
          className="w-full"
        >
          ← Voltar
        </Button>
      </div>
    );
  }

  return null;
};

export default ExistingUserSection;
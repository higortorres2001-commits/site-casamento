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
import { Loader2, Mail, User, Lock } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { isValidCPF, formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp, isValidWhatsapp } from "@/utils/whatsappValidation";
import ExistingUserSection from "./ExistingUserSection";

const emailFormSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
});

const fullFormSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  cpf: z.string()
    .transform(val => val.replace(/[^\d]+/g, ''))
    .refine(val => val.length === 11 && isValidCPF(val), {
      message: "CPF inválido",
    }),
  whatsapp: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => isValidWhatsapp(val), {
      message: "WhatsApp inválido",
    }),
});

interface SmartCheckoutFormProps {
  onUserData: (userData: any) => void;
  isLoading: boolean;
}

const SmartCheckoutForm = ({ onUserData, isLoading }: SmartCheckoutFormProps) => {
  const [step, setStep] = useState<"email" | "existing" | "new">("email");
  const [existingUserEmail, setExistingUserEmail] = useState<string>("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

  const emailForm = useForm<z.infer<typeof emailFormSchema>>({
    resolver: zodResolver(emailFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const fullForm = useForm<z.infer<typeof fullFormSchema>>({
    resolver: zodResolver(fullFormSchema),
    defaultValues: {
      name: "",
      email: "",
      cpf: "",
      whatsapp: "",
    },
  });

  const handleEmailSubmit = async (data: z.infer<typeof emailFormSchema>) => {
    setIsCheckingEmail(true);
    
    try {
      // Verificar se o e-mail existe usando a edge function
      const { data: response, error } = await supabase.functions.invoke("check-user-exists", {
        body: { email: data.email.toLowerCase().trim() },
      });

      if (error) {
        showError("Erro ao verificar e-mail. Tente novamente.");
        console.error("Email check error:", error);
        return;
      }

      if (response?.exists) {
        // Usuário existe
        setExistingUserEmail(data.email.toLowerCase().trim());
        setStep("existing");
        showSuccess("Identificamos sua conta!");
      } else {
        // Novo usuário - preencher o e-mail no formulário completo
        fullForm.setValue("email", data.email.toLowerCase().trim());
        setStep("new");
        showSuccess("Por favor, complete seus dados:");
      }
    } catch (error: any) {
      showError("Erro inesperado. Tente novamente.");
      console.error("Unexpected error:", error);
    } finally {
      setIsCheckingEmail(false);
    }
  };

  const handleNewUserSubmit = (data: z.infer<typeof fullFormSchema>) => {
    // Formatar CPF e WhatsApp para o formato correto
    const formattedData = {
      ...data,
      cpf: formatCPF(data.cpf),
      whatsapp: formatWhatsapp(data.whatsapp),
      isNewUser: true,
    };
    
    onUserData(formattedData);
  };

  const handleExistingUserAuthenticated = (userData: any) => {
    // Buscar dados completos do perfil do usuário existente
    const fetchProfileData = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('name, cpf, whatsapp')
          .eq('id', userData.id)
          .single();

        if (error) {
          showError("Erro ao carregar dados do perfil.");
          console.error("Profile fetch error:", error);
          return;
        }

        const formattedData = {
          name: profile?.name || "",
          email: userData.email || "",
          cpf: profile?.cpf ? formatCPF(profile.cpf) : "",
          whatsapp: profile?.whatsapp ? formatWhatsapp(profile.whatsapp) : "",
          isNewUser: false,
          userId: userData.id,
        };

        onUserData(formattedData);
      } catch (error: any) {
        showError("Erro ao carregar dados do usuário.");
        console.error("Profile data error:", error);
      }
    };

    fetchProfileData();
  };

  const handleBackToEmail = () => {
    setStep("email");
    emailForm.reset();
    fullForm.reset();
  };

  // Resetar o formulário quando o step muda
  useEffect(() => {
    if (step === "email") {
      emailForm.reset();
      fullForm.reset();
    }
  }, [step]);

  if (step === "email") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Dados de Acesso</h2>
          <p className="text-gray-600 mt-2">Digite seu e-mail para continuar</p>
        </div>

        <Form {...emailForm}>
          <form onSubmit={emailForm.handleSubmit(handleEmailSubmit)} className="space-y-4">
            <FormField
              control={emailForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="seu@email.com"
                      type="email"
                      {...field}
                      disabled={isCheckingEmail}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              disabled={isCheckingEmail}
            >
              {isCheckingEmail ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Verificando...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Continuar
                </>
              )}
            </Button>
          </form>
        </Form>
      </div>
    );
  }

  if (step === "existing") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Dados de Acesso</h2>
          <p className="text-gray-600 mt-2">Verifique sua identidade</p>
        </div>

        <ExistingUserSection
          email={existingUserEmail}
          onUserAuthenticated={handleExistingUserAuthenticated}
          onBackToEmail={handleBackToEmail}
        />
      </div>
    );
  }

  if (step === "new") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Complete seus Dados</h2>
          <p className="text-gray-600 mt-2">Preencha suas informações para continuar</p>
        </div>

        <Form {...fullForm}>
          <form onSubmit={fullForm.handleSubmit(handleNewUserSubmit)} className="space-y-4">
            <FormField
              control={fullForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome Completo</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Seu nome completo"
                      {...field}
                      disabled={isLoading}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={fullForm.control}
              name="cpf"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="000.000.000-00"
                      {...field}
                      disabled={isLoading}
                      maxLength={14}
                      onChange={(e) => {
                        const formatted = formatCPF(e.target.value);
                        field.onChange(formatted);
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={fullForm.control}
              name="whatsapp"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="(00) 00000-0000"
                      {...field}
                      disabled={isLoading}
                      maxLength={15}
                      onChange={(e) => {
                        const formatted = formatWhatsapp(e.target.value);
                        field.onChange(formatted);
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
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
                  Processando...
                </>
              ) : (
                <>
                  <User className="h-4 w-4 mr-2" />
                  Continuar para Pagamento
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleBackToEmail}
              className="w-full"
              disabled={isLoading}
            >
              ← Voltar
            </Button>
          </form>
        </Form>
      </div>
    );
  }

  return null;
};

export default SmartCheckoutForm;
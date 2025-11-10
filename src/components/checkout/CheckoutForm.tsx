"use client";

import React, { useImperativeHandle, forwardRef, useState, useEffect } from "react";
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
import { Loader2, Mail, User, Shield, CheckCircle } from "lucide-react";
import { isValidCPF, formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp, isValidWhatsapp } from "@/utils/whatsappValidation";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import EmailVerificationModal from "./EmailVerificationModal";
import { useEmailExistence } from "@/hooks/use-email-existence";

export interface CheckoutFormRef {
  submitForm: () => Promise<boolean>;
  getValues: () => z.infer<typeof formSchema>;
}

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  cpf: z.string()
    .transform(val => val.replace(/[^\d]+/g, '')) // Limpa o CPF, deixando apenas dígitos
    .refine(val => val.length === 11 && isValidCPF(val), { // Valida o comprimento e a lógica do CPF
      message: "CPF inválido",
    }),
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  whatsapp: z.string()
    .transform(val => val.replace(/\D/g, '')) // Limpa o WhatsApp, deixando apenas dígitos
    .refine(val => isValidWhatsapp(val), { // Valida o comprimento (10 ou 11 dígitos)
      message: "Número de WhatsApp inválido",
    }),
});

interface CheckoutFormProps {
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  isLoading: boolean;
  initialData?: {
    name?: string | null;
    cpf?: string | null;
    email?: string | null;
    whatsapp?: string | null;
  };
}

const CheckoutForm = forwardRef<CheckoutFormRef, CheckoutFormProps>(
  ({ onSubmit, isLoading, initialData }, ref) => {
    // Estados para controle de verificação de email
    const [isCheckingEmail, setIsCheckingEmail] = useState(false);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [emailForVerification, setEmailForVerification] = useState("");
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    
    // Hook para verificar existência de email
    const { checkEmailExists, isChecking } = useEmailExistence();

    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: initialData || {
        name: "",
        cpf: "",
        email: "",
        whatsapp: "",
      },
    });

    useImperativeHandle(ref, () => ({
      submitForm: async () => {
        // Se for um usuário existente, verificar se o email foi verificado
        if (isExistingUser && !isEmailVerified) {
          showError("Por favor, verifique seu e-mail antes de continuar.");
          return false;
        }
        return form.trigger();
      },
      getValues: () => form.getValues(),
    }));

    // Verificar email quando o usuário termina de digitar
    const handleEmailBlur = async () => {
      const email = form.getValues("email");
      if (!email || !email.includes("@")) return;
      
      setIsCheckingEmail(true);
      try {
        console.log("🔍 Checking email on blur:", email);
        const exists = await checkEmailExists(email);
        console.log("📧 Email exists:", exists);
        
        if (exists && !isEmailVerified) {
          setIsExistingUser(true);
        }
      } catch (error) {
        console.error("Error checking email:", error);
      } finally {
        setIsCheckingEmail(false);
      }
    };

    // Iniciar processo de verificação de email
    const handleStartVerification = () => {
      const email = form.getValues("email");
      if (!email || !email.includes("@")) {
        showError("Por favor, digite um e-mail válido.");
        return;
      }
      
      setEmailForVerification(email);
      setIsVerificationModalOpen(true);
    };

    // Callback quando a verificação é concluída
    const handleVerificationComplete = (userData: { name: string; cpf: string; whatsapp: string }) => {
      console.log("✅ Verification completed with user data:", userData);
      setIsEmailVerified(true);
      setIsVerificationModalOpen(false);
      
      // Preencher o formulário com os dados do usuário
      form.setValue("name", userData.name);
      form.setValue("cpf", formatCPF(userData.cpf));
      form.setValue("whatsapp", formatWhatsapp(userData.whatsapp));
      
      // Marcar campos como "touched" para validação
      form.trigger();
      
      showSuccess("E-mail verificado com sucesso!");
    };

    return (
      <>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="text-center mb-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {isExistingUser ? "Bem-vindo de volta!" : "Preencha seus dados"}
              </h3>
              <p className="text-sm text-gray-600">
                {isExistingUser 
                  ? "Vimos que você já é nosso cliente. Para sua segurança, precisamos verificar seu e-mail."
                  : "Preencha os dados abaixo para continuar com sua compra."
                }
              </p>
            </div>

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
                        onBlur={handleEmailBlur}
                        className="focus:ring-orange-500 focus:border-orange-500 pr-10"
                        type="email"
                        disabled={isLoading || isEmailVerified}
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isCheckingEmail || isChecking ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                        ) : isEmailVerified ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : isExistingUser ? (
                          <Mail className="h-4 w-4 text-blue-600" />
                        ) : field.value ? (
                          <User className="h-4 w-4 text-gray-400" />
                        ) : null}
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {isExistingUser && !isEmailVerified ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-blue-800">Verificação necessária</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Para sua segurança, precisamos verificar seu e-mail antes de continuar.
                  </p>
                </div>
                
                <Button
                  type="button"
                  onClick={handleStartVerification}
                  disabled={isLoading || !form.getValues("email")}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Verificar E-mail
                </Button>
              </div>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome Completo</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Seu nome completo"
                          {...field}
                          className="focus:ring-orange-500 focus:border-orange-500"
                          disabled={isLoading || (isExistingUser && !isEmailVerified)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="cpf"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPF</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="000.000.000-00"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatCPF(e.target.value);
                            field.onChange(formatted);
                          }}
                          onBlur={(e) => {
                            // Garante que o campo seja formatado corretamente ao perder o foco
                            const cleanedCpf = e.target.value.replace(/[^\d]+/g, "");
                            if (cleanedCpf.length === 11 && isValidCPF(cleanedCpf)) {
                              field.onChange(formatCPF(cleanedCpf));
                            } else {
                              field.onChange(e.target.value); // Mantém o valor digitado se for inválido para o usuário corrigir
                            }
                          }}
                          maxLength={14}
                          className="focus:ring-orange-500 focus:border-orange-500"
                          disabled={isLoading || (isExistingUser && !isEmailVerified)}
                        />
                      </FormControl>
                      <FormMessage className="bg-pink-100 text-pink-800 p-2 rounded-md mt-2" />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="whatsapp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>WhatsApp</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="(XX) XXXXX-XXXX"
                          {...field}
                          onChange={(e) => {
                            const formatted = formatWhatsapp(e.target.value);
                            field.onChange(formatted);
                          }}
                          maxLength={15}
                          className="focus:ring-orange-500 focus:border-orange-500"
                          disabled={isLoading || (isExistingUser && !isEmailVerified)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
          </form>
        </Form>

        {/* Modal de verificação de e-mail */}
        <EmailVerificationModal
          email={emailForVerification}
          isOpen={isVerificationModalOpen}
          onClose={() => setIsVerificationModalOpen(false)}
          onVerified={handleVerificationComplete}
        />
      </>
    );
  }
);

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
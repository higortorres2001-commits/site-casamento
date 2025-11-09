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
import OtpVerification from "./OtpVerification";
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
    const [showOtp, setShowOtp] = useState(false);
    const [isExistingUser, setIsExistingUser] = useState(false);
    const [emailForOtp, setEmailForOtp] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    
    const { checkEmailExists, isChecking, emailExists, error: emailCheckError } = useEmailExistence();

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
      submitForm: () => {
        return form.trigger();
      },
      getValues: () => form.getValues(),
    }));

    // Verificar email quando o usuário para de digitar (debounce)
    const handleEmailChange = async (email: string) => {
      if (!email || !email.includes("@")) {
        setIsExistingUser(false);
        return;
      }

      const exists = await checkEmailExists(email);
      setIsExistingUser(exists);
    };

    // Debounce para não chamar a cada digitação
    const debouncedEmailCheck = React.useCallback(
      (email: string) => {
        const timer = setTimeout(() => {
          handleEmailChange(email);
        }, 500);
        return () => clearTimeout(timer);
      },
      [checkEmailExists]
    );

    const handleEmailInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const email = e.target.value;
      form.setValue("email", email);
      debouncedEmailCheck(email);
    };

    const handleSendOtp = async () => {
      const email = form.getValues("email");
      if (!email) {
        showError("Por favor, digite seu e-mail primeiro.");
        return;
      }

      setIsSendingOtp(true);

      try {
        console.log("📧 Sending OTP to:", email);
        
        const { error } = await supabase.auth.signInWithOtp({
          email: email.toLowerCase().trim()
        });

        if (error) {
          console.error("Error sending OTP:", error);
          showError("Erro ao enviar código. Tente novamente.");
        } else {
          console.log("✅ OTP sent successfully");
          showSuccess("Código enviado para seu e-mail!");
          setEmailForOtp(email);
          setShowOtp(true);
        }
      } catch (error: any) {
        console.error("Unexpected error sending OTP:", error);
        showError("Erro inesperado. Tente novamente.");
      } finally {
        setIsSendingOtp(false);
      }
    };

    const handleOtpVerified = () => {
      setShowOtp(false);
      // O formulário será preenchido automaticamente pelo componente OTP
    };

    const handleUserDataLoaded = (userData: { name: string; cpf: string; whatsapp: string }) => {
      // Preencher o formulário com os dados do usuário
      form.setValue("name", userData.name);
      form.setValue("cpf", formatCPF(userData.cpf));
      form.setValue("whatsapp", formatWhatsapp(userData.whatsapp));
    };

    const handleBackToEmail = () => {
      setShowOtp(false);
      setIsExistingUser(false);
    };

    // Se estiver mostrando OTP, renderiza o componente OTP
    if (showOtp) {
      return (
        <OtpVerification
          email={emailForOtp}
          onVerified={handleOtpVerified}
          onBack={handleBackToEmail}
          onUserDataLoaded={handleUserDataLoaded}
        />
      );
    }

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="text-center mb-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {isExistingUser ? "Bem-vindo de volta!" : "Preencha seus dados"}
            </h3>
            <p className="text-sm text-gray-600">
              {isExistingUser 
                ? "Vimos que você já é nosso cliente. Para sua segurança, enviaremos um código para seu e-mail."
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
                      onChange={handleEmailInput}
                      className="focus:ring-orange-500 focus:border-orange-500 pr-10"
                      type="email"
                    />
                    {isChecking && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
                    )}
                    {emailExists !== null && !isChecking && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {emailExists ? (
                          <Mail className="h-4 w-4 text-blue-600" />
                        ) : (
                          <User className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormMessage />
                {emailCheckError && (
                  <p className="text-sm text-red-600 mt-1">{emailCheckError}</p>
                )}
              </FormItem>
            )}
          />

          {isExistingUser ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-800">Verificação necessária</span>
                </div>
                <p className="text-sm text-blue-700">
                  Para sua segurança, enviamos um código de 6 dígitos para o seu e-mail.
                </p>
              </div>
              
              <Button
                type="button"
                onClick={handleSendOtp}
                disabled={isSendingOtp || !form.getValues("email")}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSendingOtp ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando código...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Enviar Código por E-mail
                  </>
                )}
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
    );
  }
);

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
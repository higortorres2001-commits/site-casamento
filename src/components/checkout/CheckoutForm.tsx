"use client";

import React, { useImperativeHandle, forwardRef } from "react";
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
import { isValidCPF, formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp, isValidWhatsapp } from "@/utils/whatsappValidation";

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
        return form.trigger(); // Apenas dispara a validação e retorna o resultado
      },
      getValues: () => form.getValues(),
    }));

    return (
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
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
                    maxLength={14}
                    className="focus:ring-orange-500 focus:border-orange-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
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
          {/* O botão de submit foi movido para FixedBottomBar */}
        </form>
      </Form>
    );
  }
);

CheckoutForm.displayName = "CheckoutForm";

export default CheckoutForm;
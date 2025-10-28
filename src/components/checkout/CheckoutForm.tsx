"use client";

import React from "react";
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
import { isValidCPF, formatCPF } from "@/utils/cpfValidation"; // Import CPF validation

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  cpf: z.string()
    .min(11, "O CPF é obrigatório e deve ter 11 dígitos")
    .max(14, "O CPF deve ter no máximo 14 caracteres (com formatação)")
    .refine((cpf) => isValidCPF(cpf.replace(/[^\d]+/g, "")), {
      message: "CPF inválido",
    }),
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
});

interface CheckoutFormProps {
  onSubmit: (data: z.infer<typeof formSchema>) => void;
  isLoading: boolean;
  initialData?: {
    name?: string;
    cpf?: string;
    email?: string;
  };
}

const CheckoutForm = ({ onSubmit, isLoading, initialData }: CheckoutFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData || {
      name: "",
      cpf: "",
      email: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <h2 className="text-2xl font-bold mb-4">Seus Dados</h2>
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
                    const cleanedCpf = e.target.value.replace(/[^\d]+/g, "");
                    if (cleanedCpf.length === 11 && isValidCPF(cleanedCpf)) {
                      field.onChange(formatCPF(cleanedCpf));
                    } else {
                      field.onChange(e.target.value); // Keep invalid input for user to correct
                    }
                  }}
                  maxLength={14} // Max length for formatted CPF
                  className="focus:ring-orange-500 focus:border-orange-500"
                />
              </FormControl>
              <FormMessage className="bg-pink-100 text-pink-800 p-2 rounded-md mt-2" />
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
        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
          disabled={isLoading}
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar Compra Agora"}
        </Button>
      </form>
    </Form>
  );
};

export default CheckoutForm;
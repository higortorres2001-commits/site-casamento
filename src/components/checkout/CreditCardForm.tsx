"use client";

import React, { useImperativeHandle, forwardRef } from "react";
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
import { Input } from "@/components/ui/input";
import { Info } from "lucide-react"; // Importar o ícone de informação

export interface CreditCardFormRef {
  submitForm: () => Promise<boolean>;
  getValues: () => z.infer<typeof formSchema>;
}

const formSchema = z.object({
  holderName: z.string().min(1, "O nome no cartão é obrigatório"),
  cardNumber: z.string().min(16, "Número do cartão inválido").max(19, "Número do cartão inválido"),
  expiryMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Mês inválido (MM)"),
  expiryYear: z.string().regex(/^\d{2}$/, "Ano inválido (AA)"),
  ccv: z.string().min(3, "CVV inválido").max(4, "CVV inválido"),
  postalCode: z.string()
    .min(1, "O CEP é obrigatório")
    .regex(/^\d{5}-?\d{3}$/, "CEP inválido (formato XXXXX-XXX)"),
  addressNumber: z.string().min(1, "O número é obrigatório"),
});

interface CreditCardFormProps {
  isLoading: boolean;
}

const CreditCardForm = forwardRef<CreditCardFormRef, CreditCardFormProps>(
  ({ isLoading }, ref) => {
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        holderName: "",
        cardNumber: "",
        expiryMonth: "",
        expiryYear: "",
        ccv: "",
        postalCode: "",
        addressNumber: "",
      },
    });

    useImperativeHandle(ref, () => ({
      submitForm: async () => {
        const isValid = await form.trigger();
        return isValid;
      },
      getValues: () => form.getValues(),
    }));

    const formatCEP = (value: string) => {
      if (!value) return "";
      value = value.replace(/\D/g, ""); // Remove tudo o que não é dígito
      value = value.replace(/^(\d{5})(\d)/, "$1-$2"); // Coloca o hífen após o 5º dígito
      return value;
    };

    return (
      <Form {...form}>
        <form className="space-y-4">
          <FormField
            control={form.control}
            name="holderName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome no Cartão</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome Completo no Cartão"
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
            control={form.control}
            name="cardNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Número do Cartão</FormLabel>
                <FormControl>
                  <Input
                    placeholder="XXXX XXXX XXXX XXXX"
                    {...field}
                    disabled={isLoading}
                    maxLength={19} // Max length for formatted card number
                    onChange={(e) => {
                      // Basic formatting for card number
                      const value = e.target.value.replace(/\D/g, '').substring(0, 16);
                      const formatted = value.replace(/(\d{4})(?=\d)/g, '$1 ');
                      field.onChange(formatted);
                    }}
                    className="focus:ring-orange-500 focus:border-orange-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="expiryMonth"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Mês (MM)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="MM"
                      {...field}
                      disabled={isLoading}
                      maxLength={2}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').substring(0, 2);
                        field.onChange(value);
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="expiryYear"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Ano (AA)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="AA"
                      {...field}
                      disabled={isLoading}
                      maxLength={2}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').substring(0, 2);
                        field.onChange(value);
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ccv"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CVV</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="XXX"
                      {...field}
                      disabled={isLoading}
                      maxLength={4}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').substring(0, 4);
                        field.onChange(value);
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Novos campos de endereço para cobrança */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">Dados de Cobrança do Cartão</h3>
            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="XXXXX-XXX"
                      {...field}
                      disabled={isLoading}
                      maxLength={9} // 5 dígitos + hífen + 3 dígitos
                      onChange={(e) => {
                        field.onChange(formatCEP(e.target.value));
                      }}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="addressNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Número</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Número do endereço"
                      {...field}
                      disabled={isLoading}
                      className="focus:ring-orange-500 focus:border-orange-500"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <p className="flex items-center text-sm text-gray-500 mt-2">
              <Info className="h-4 w-4 mr-1 text-blue-500" />
              Estas informações são usadas apenas para a validação anti-fraude do seu cartão.
            </p>
          </div>
        </form>
      </Form>
    );
  }
);

CreditCardForm.displayName = "CreditCardForm";

export default CreditCardForm;
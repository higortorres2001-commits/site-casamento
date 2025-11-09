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
import { Info } from "lucide-react";
import InstallmentSelector from "./InstallmentSelector";
import { useInstallments } from "@/hooks/use-installments";

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
  installmentCount: z.number().min(1, "Selecione o número de parcelas"),
});

interface CreditCardFormProps {
  isLoading: boolean;
  totalPrice: number;
}

const CreditCardForm = forwardRef<CreditCardFormRef, CreditCardFormProps>(
  ({ isLoading, totalPrice }, ref) => {
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
        installmentCount: 1,
      },
    });

    // Hook para calcular parcelas com debounce
    const { installments, isLoading: isLoadingInstallments, error: installmentsError } = useInstallments({
      totalPrice,
      enabled: true, // Sempre habilitado quando este form está visível
    });

    useImperativeHandle(ref, () => ({
      submitForm: async () => {
        console.log("💳 Submitting credit card form...");
        
        // Validar todos os campos
        const isValid = await form.trigger();
        console.log("💳 Form validation result:", isValid);
        
        if (!isValid) {
          console.error("❌ Credit card form validation failed");
          return false;
        }
        
        const values = form.getValues();
        console.log("💳 Credit card form values:", values);
        
        // Validações adicionais
        const currentYear = new Date().getFullYear() % 100;
        const currentMonth = new Date().getMonth() + 1;
        const expYear = parseInt(values.expiryYear);
        const expMonth = parseInt(values.expiryMonth);
        
        // Verificar se o cartão não está expirado
        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
          console.error("❌ Credit card is expired");
          form.setError("expiryYear", { message: "Cartão expirado" });
          return false;
        }
        
        console.log("✅ Credit card form is valid");
        return true;
      },
      getValues: () => {
        const values = form.getValues();
        console.log("💳 Getting credit card values:", values);
        return values;
      },
    }));

    const formatCEP = (value: string) => {
      if (!value) return "";
      value = value.replace(/\D/g, "");
      value = value.replace(/^(\d{5})(\d)/, "$1-$2");
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
                    placeholder="XXXX XXXX XXXX"
                    {...field}
                    disabled={isLoading}
                    maxLength={19}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').substring(0, 16);
                      const formatted = value.replace(/(\d{4})(?=\d)/, '$1 $2').replace(/(\d{4})(?=\d)/, '$1 $2').replace(/(\d{4})(?=\d)/, '$1 $2');
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

          {/* Seletor de Parcelas */}
          <FormField
            control={form.control}
            name="installmentCount"
            render={({ field }) => (
              <FormItem>
                <InstallmentSelector
                  installments={installments}
                  isLoading={isLoadingInstallments}
                  error={installmentsError}
                  selectedInstallment={field.value}
                  onSelectInstallment={field.onChange}
                  disabled={isLoading}
                />
                <FormMessage />
              </FormItem>
            )}
          />

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
                      maxLength={9}
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
              Estas informações são usadas apenas para a validação de segurança do seu cartão.
            </p>
          </div>
        </form>
      </Form>
    );
  }
);

CreditCardForm.displayName = "CreditCardForm";

export default CreditCardForm;
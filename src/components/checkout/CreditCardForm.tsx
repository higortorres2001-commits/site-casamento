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
      },
    });

    useImperativeHandle(ref, () => ({
      submitForm: async () => {
        const isValid = await form.trigger();
        return isValid;
      },
      getValues: () => form.getValues(),
    }));

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
        </form>
      </Form>
    );
  }
);

CreditCardForm.displayName = "CreditCardForm";

export default CreditCardForm;
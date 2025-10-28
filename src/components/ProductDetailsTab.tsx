"use client";

import React from "react";
import { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(), // Array of product IDs
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")), // Adicionado image_url
});

interface ProductDetailsTabProps {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  isLoading: boolean;
}

const ProductDetailsTab = ({ form, isLoading }: ProductDetailsTabProps) => {
  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Nome do Produto</FormLabel>
            <FormControl>
              <Input placeholder="Ex: Curso de Marketing Digital" {...field} disabled={isLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="price"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Preço</FormLabel>
            <FormControl>
              <Input type="number" step="0.01" placeholder="Ex: 99.90" {...field} disabled={isLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Descrição</FormLabel>
            <FormControl>
              <Textarea placeholder="Uma breve descrição do produto" {...field} disabled={isLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="memberareaurl"
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL da Área de Membros</FormLabel>
            <FormControl>
              <Input placeholder="Ex: https://minha-area-de-membros.com" {...field} disabled={isLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name="image_url"
        render={({ field }) => (
          <FormItem>
            <FormLabel>URL da Imagem do Produto</FormLabel>
            <FormControl>
              <Input placeholder="Ex: https://seusite.com/imagem-produto.jpg" {...field} disabled={isLoading} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
};

export default ProductDetailsTab;
"use client";

import React, { useEffect, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Product, ProductAsset } from "@/types";
import { X } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.string().optional(), // Comma-separated product IDs
});

interface ProductFormProps {
  initialData?: Product & { assets?: ProductAsset[] };
  onSubmit: (data: z.infer<typeof formSchema>, files: File[]) => void;
  onCancel: () => void;
  isLoading: boolean;
  onDeleteAsset: (assetId: string) => void;
}

const ProductForm = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  onDeleteAsset,
}: ProductFormProps) => {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          orderbumps: initialData.orderbumps?.join(", ") || "",
        }
      : {
          name: "",
          price: 0,
          description: "",
          memberareaurl: "",
          orderbumps: "",
        },
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        orderbumps: initialData.orderbumps?.join(", ") || "",
      });
    } else {
      form.reset({
        name: "",
        price: 0,
        description: "",
        memberareaurl: "",
        orderbumps: "",
      });
    }
    setSelectedFiles([]); // Clear files on form reset
  }, [initialData, form]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleSubmit = (data: z.infer<typeof formSchema>) => {
    onSubmit(data, selectedFiles);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nome do Produto</FormLabel>
              <FormControl>
                <Input placeholder="Ex: Curso de Marketing Digital" {...field} />
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
                <Input type="number" step="0.01" placeholder="Ex: 99.90" {...field} />
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
                <Textarea placeholder="Uma breve descrição do produto" {...field} />
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
                <Input placeholder="Ex: https://minha-area-de-membros.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="orderbumps"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Order Bumps (IDs separados por vírgula)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: id1, id2, id3"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* File Uploader */}
        <FormItem>
          <FormLabel>Arquivos do Produto (PDFs)</FormLabel>
          <FormControl>
            <Input type="file" multiple accept=".pdf" onChange={handleFileChange} />
          </FormControl>
          <FormMessage />
        </FormItem>

        {/* Display existing assets */}
        {initialData?.assets && initialData.assets.length > 0 && (
          <div className="space-y-2">
            <FormLabel>Arquivos Existentes:</FormLabel>
            {initialData.assets.map((asset) => (
              <div key={asset.id} className="flex items-center justify-between p-2 border rounded-md">
                <span>{asset.file_name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDeleteAsset(asset.id)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
          <Button type="submit" className="bg-orange-500 hover:bg-orange-600 text-white" disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar Produto"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

export default ProductForm;
"use client";

import React, { useState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ProductForm = z.infer<typeof formSchema>;

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(),
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")),
  status: z.enum(["draft", "ativo", "inativo"]),
  tag: z.string().optional(),
  return_url: z.string().url("URL inválida").optional().or(z.literal("")),
});

interface ProductDetailsTabProps {
  form: UseFormReturn<ProductForm>;
  isLoading: boolean;
  onImageFileChange: (file: File | null) => void;
  initialImageUrl?: string | null;
  isAdmin?: boolean;
}

const ProductDetailsTab = ({
  form,
  isLoading,
  onImageFileChange,
  initialImageUrl,
}: ProductDetailsTabProps) => {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialImageUrl ?? null);
  const [imageError, setImageError] = useState<string | null>(null);

  useEffect(() => {
    if (initialImageUrl) {
      setImagePreviewUrl(initialImageUrl);
    }
  }, [initialImageUrl]);

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (file) {
      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = () => setImagePreviewUrl(reader.result as string);
      reader.readAsDataURL(file);
      onImageFileChange(file);
    } else {
      setSelectedImageFile(null);
      setImagePreviewUrl(initialImageUrl ?? null);
      onImageFileChange(null);
    }
  };

  return (
    <div className="space-y-4">
      <FormField control={form.control} name="name" render={({ field }) => (
        <FormItem>
          <FormLabel>Nome do Produto</FormLabel>
          <FormControl>
            <Input placeholder="Nome do produto" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="price" render={({ field }) => (
        <FormItem>
          <FormLabel>Preço</FormLabel>
          <FormControl>
            <Input type="number" step="0.01" placeholder="0,00" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descrição</FormLabel>
          <FormControl>
            <Textarea placeholder="Descrição do produto" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="memberareaurl" render={({ field }) => (
        <FormItem>
          <FormLabel>URL de Conteúdo</FormLabel>
          <FormControl>
            <Input placeholder="https://..." {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="orderbumps" render={({ field }) => (
        <FormItem>
          <FormLabel>Order Bumps (IDs separados por vírgula)</FormLabel>
          <FormControl>
            <Input
              placeholder="ID1, ID2"
              value={Array.isArray(field.value) ? field.value.join(", ") : ""}
              onChange={(e) => {
                const value = e.target.value;
                const arr = value
                  .split(",")
                  .map((s) => s.trim())
                  .filter((s) => s.length > 0);
                field.onChange(arr);
              }}
              disabled={isLoading}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="image_url" render={({ field }) => (
        <FormItem>
          <FormLabel>Imagem (URL)</FormLabel>
          <FormControl>
            <Input placeholder="URL da imagem" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      {/* Image Upload (com preview) */}
      <FormItem>
        <FormLabel>Imagem do Produto</FormLabel>
        <div className="flex items-center space-x-2">
          <Input type="file" accept="image/*" onChange={handleImageFileChange} disabled={isLoading} />
        </div>
        {imagePreviewUrl && (
          <div className="mt-2 w-48 h-48 border rounded-md overflow-hidden">
            <img src={imagePreviewUrl} alt="Pré-visualização" className="w-full h-full object-cover" />
          </div>
        )}
        {imageError && <FormMessage className="text-red-500">{imageError}</FormMessage>}
      </FormItem>

      <FormField control={form.control} name="tag" render={({ field }) => (
        <FormItem>
          <FormLabel>Tag</FormLabel>
          <FormControl>
            <Input placeholder="Ex: curso-marketing" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="return_url" render={({ field }) => (
        <FormItem>
          <FormLabel>Return URL</FormLabel>
          <FormControl>
            <Input placeholder="https://seu-site.com/voltar-para-produto" {...field} disabled={isLoading} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />

      <FormField control={form.control} name="status" render={({ field }) => (
        <FormItem>
          <FormLabel>Status do Produto</FormLabel>
          <FormControl>
            <Select onValueChange={field.onChange} defaultValue={field.value ?? "draft"}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  );
};

export default ProductDetailsTab;
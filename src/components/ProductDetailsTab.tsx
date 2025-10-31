"use client";

import React, { useState } from "react";
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
  form: UseFormReturn<z.infer<typeof formSchema>>;
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
  isAdmin = false,
}: ProductDetailsTabProps) => {
  // Mantemos a pré-visualização da imagem
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialImageUrl ?? null);
  const [imageError, setImageError] = useState<string | null>(null);

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
      {isAdmin && (
        <>
          <FormField
            control={form?.control}
            name="tag"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tag (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Ex: curso-marketing" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form?.control}
            name="return_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Return URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://seu-site.com/voltar-para-produto" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}
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
      {/* Demais campos já existentes (name, price, etc.) ficam gerenciados pelos campos do formulário externo */}
    </div>
  );
};

export default ProductDetailsTab;
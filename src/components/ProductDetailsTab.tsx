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
import { X } from "lucide-react";
import { showError } from "@/utils/toast";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(), // Array of product IDs
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")), // Adicionado image_url
  status: z.enum(["draft", "ativo", "inativo"]), // Adicionado status
});

interface ProductDetailsTabProps {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  isLoading: boolean;
  onImageFileChange: (file: File | null) => void; // New prop to pass file up
  initialImageUrl?: string | null; // New prop for initial image URL
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MIN_DIMENSION = 500; // 500x500 pixels

const ProductDetailsTab = ({ form, isLoading, onImageFileChange, initialImageUrl }: ProductDetailsTabProps) => {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  // Effect to set initial image preview from initialImageUrl
  useEffect(() => {
    if (initialImageUrl && !selectedImageFile) { // Only set if no file is currently selected
      setImagePreviewUrl(initialImageUrl);
    } else if (!initialImageUrl && !selectedImageFile) {
      setImagePreviewUrl(null);
    }
  }, [initialImageUrl, selectedImageFile]);

  // Effect to clear selected file when form is reset (e.g., creating new product)
  useEffect(() => {
    if (!form.formState.isDirty && !initialImageUrl) { // If form is clean and no initial image
      setSelectedImageFile(null);
      setImagePreviewUrl(null);
      setImageError(null);
    }
  }, [form.formState.isDirty, initialImageUrl]);


  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setImageError(null); // Clear previous errors
    const file = event.target.files?.[0];

    if (!file) {
      setSelectedImageFile(null);
      setImagePreviewUrl(initialImageUrl || null); // Revert to initial if no new file
      onImageFileChange(null);
      return;
    }

    if (!file.type.startsWith('image/')) {
      setImageError("O arquivo selecionado não é uma imagem.");
      setSelectedImageFile(null);
      setImagePreviewUrl(initialImageUrl || null);
      onImageFileChange(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setImageError("A imagem deve ter no máximo 5MB.");
      setSelectedImageFile(null);
      setImagePreviewUrl(initialImageUrl || null);
      onImageFileChange(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width < MIN_DIMENSION || img.height < MIN_DIMENSION) {
          setImageError(`A imagem deve ter no mínimo ${MIN_DIMENSION}x${MIN_DIMENSION} pixels.`);
          setSelectedImageFile(null);
          setImagePreviewUrl(initialImageUrl || null);
          onImageFileChange(null);
        } else {
          setSelectedImageFile(file);
          setImagePreviewUrl(e.target?.result as string);
          onImageFileChange(file);
          form.setValue("image_url", "", { shouldDirty: true }); // Clear the URL field if a file is uploaded
        }
      };
      img.onerror = () => {
        setImageError("Não foi possível carregar a imagem para validação de dimensões.");
        setSelectedImageFile(null);
        setImagePreviewUrl(initialImageUrl || null);
        onImageFileChange(null);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreviewUrl(null);
    setImageError(null);
    onImageFileChange(null);
    form.setValue("image_url", "", { shouldDirty: true }); // Explicitly clear the URL field
  };

  const currentImageToDisplay = selectedImageFile ? imagePreviewUrl : (form.getValues("image_url") || initialImageUrl);

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="status"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status do Produto</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value} disabled={isLoading}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="draft">Rascunho</SelectItem>
                <SelectItem value="ativo">Ativo (Disponível para compra)</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
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

      {/* Image Upload Section */}
      <FormItem>
        <FormLabel>Imagem do Produto</FormLabel>
        <div className="flex items-center space-x-2">
          <Input
            type="file"
            accept="image/*"
            onChange={handleImageFileChange}
            disabled={isLoading}
            className="flex-1"
          />
          {(currentImageToDisplay || selectedImageFile) && (
            <Button
              variant="outline"
              size="icon"
              onClick={handleRemoveImage}
              disabled={isLoading}
              className="shrink-0"
            >
              <X className="h-4 w-4 text-red-500" />
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Formatos aceitos: JPG, PNG. Tamanho máximo: 5MB. Dimensões mínimas: 500x500 pixels.
        </p>
        {imageError && <FormMessage className="text-red-500">{imageError}</FormMessage>}
        {currentImageToDisplay && (
          <div className="mt-4 relative w-48 h-48 border rounded-md overflow-hidden">
            <img src={currentImageToDisplay} alt="Pré-visualização da imagem" className="w-full h-full object-cover" />
          </div>
        )}
      </FormItem>

      {/* Original image_url field, now conditionally rendered */}
      {!selectedImageFile && ( // Only show URL input if no file is selected
        <FormField
          control={form.control}
          name="image_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL da Imagem do Produto (ou use o upload acima)</FormLabel>
              <FormControl>
                <Input
                  placeholder="Ex: https://seusite.com/imagem-produto.jpg"
                  {...field}
                  disabled={isLoading}
                  className="focus:ring-orange-500 focus:border-orange-500"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  );
};

export default ProductDetailsTab;
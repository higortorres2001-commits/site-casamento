"use client";

import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product, ProductAsset } from "@/types";
import ProductDetailsTab from "./ProductDetailsTab";
import ProductOrderBumpsTab from "./ProductOrderBumpsTab";
import ProductAssetsTab from "./ProductAssetsTab";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Form } from "@/components/ui/form"; // Importa o componente Form do shadcn/ui

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(), // Array of product IDs
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")), // Adicionado image_url
});

interface ProductEditTabsProps {
  initialData?: Product & { assets?: ProductAsset[] };
  onSubmit: (
    data: z.infer<typeof formSchema>,
    files: File[],
    deletedAssetIds: string[],
    imageFile: File | null, // New: Pass image file
    oldImageUrl: string | null // New: Pass old image URL for deletion logic
  ) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ProductEditTabs = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: ProductEditTabsProps) => {
  const { user } = useSession();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
          ...initialData,
          orderbumps: initialData.orderbumps || [],
          image_url: initialData.image_url || "", // Definir default para image_url
        }
      : {
          name: "",
          price: 0,
          description: "",
          memberareaurl: "",
          orderbumps: [],
          image_url: "", // Definir default para image_url
        },
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deletedAssetIds, setDeletedAssetIds] = useState<string[]>([]);
  const [currentAssets, setCurrentAssets] = useState<ProductAsset[]>(initialData?.assets || []);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null); // New state for product image

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        orderbumps: initialData.orderbumps || [],
        image_url: initialData.image_url || "",
      });
      setCurrentAssets(initialData.assets || []);
      setDeletedAssetIds([]);
      setSelectedImageFile(null); // Clear selected image file on initialData change
    } else {
      form.reset({
        name: "",
        price: 0,
        description: "",
        memberareaurl: "",
        orderbumps: [],
        image_url: "",
      });
      setCurrentAssets([]);
      setDeletedAssetIds([]);
      setSelectedFiles([]);
      setSelectedImageFile(null); // Clear selected image file
    }
  }, [initialData, form]);

  const handleFileChange = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este arquivo?")) return;

    // Optimistically remove from current assets
    setCurrentAssets((prev) => prev.filter((asset) => asset.id !== assetId));
    setDeletedAssetIds((prev) => [...prev, assetId]);
    showSuccess("Arquivo marcado para exclusão.");
  };

  const handleImageFileChange = (file: File | null) => {
    setSelectedImageFile(file);
  };

  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    onSubmit(data, selectedFiles, deletedAssetIds, selectedImageFile, initialData?.image_url || null);
  };

  return (
    <Tabs defaultValue="details" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="details">Detalhes do Produto</TabsTrigger>
        <TabsTrigger value="order-bumps">Order Bumps</TabsTrigger>
        <TabsTrigger value="files">Arquivos (PDFs)</TabsTrigger>
      </TabsList>
      <Form {...form}> {/* Envolve o formulário HTML com o componente Form do shadcn/ui */}
        <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-4 mt-4">
          <TabsContent value="details">
            <ProductDetailsTab
              form={form}
              isLoading={isLoading}
              onImageFileChange={handleImageFileChange}
              initialImageUrl={initialData?.image_url}
            />
          </TabsContent>
          <TabsContent value="order-bumps">
            <ProductOrderBumpsTab form={form} isLoading={isLoading} currentProductId={initialData?.id} />
          </TabsContent>
          <TabsContent value="files">
            <ProductAssetsTab
              initialAssets={currentAssets}
              onFileChange={handleFileChange}
              onDeleteAsset={handleDeleteAsset}
              isLoading={isLoading}
            />
          </TabsContent>
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
    </Tabs>
  );
};

export default ProductEditTabs;
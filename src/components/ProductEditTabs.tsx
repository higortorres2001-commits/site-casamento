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
import ProductKitTab from "./ProductKitTab";
import { Form } from "@/components/ui/form";
import { Package } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(),
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")),
  status: z.enum(["draft", "ativo", "inativo"]),
  internal_tag: z.string().optional(),
  checkout_return_url: z.string().url("URL inválida").optional().or(z.literal("")),
  also_buy: z.boolean().default(false),
  // Kit fields
  is_kit: z.boolean().default(false),
  kit_product_ids: z.array(z.string()).optional(),
  kit_original_value: z.coerce.number().optional().nullable(),
});

interface ProductEditTabsProps {
  initialData?: Product & { assets?: ProductAsset[] };
  onSubmit: (
    data: z.infer<typeof formSchema>,
    files: File[],
    deletedAssetIds: string[],
    imageFile: File | null,
    oldImageUrl: string | null
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
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: initialData
      ? {
        ...initialData,
        orderbumps: initialData.orderbumps || [],
        image_url: initialData.image_url || "",
        status: initialData.status || "draft",
        internal_tag: (initialData as any).internal_tag ?? "",
        checkout_return_url: initialData.checkout_return_url || "",
        also_buy: (initialData as any).also_buy ?? false,
        is_kit: (initialData as any).is_kit ?? false,
        kit_product_ids: (initialData as any).kit_product_ids ?? [],
      }
      : {
        name: "",
        price: 0,
        description: "",
        memberareaurl: "",
        orderbumps: [],
        image_url: "",
        status: "draft",
        internal_tag: "",
        checkout_return_url: "",
        also_buy: false,
        is_kit: false,
        kit_product_ids: [],
      },
  });

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deletedAssetIds, setDeletedAssetIds] = useState<string[]>([]);
  const [currentAssets, setCurrentAssets] = useState<ProductAsset[]>(initialData?.assets || []);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  const isKit = form.watch("is_kit");

  useEffect(() => {
    if (initialData) {
      form.reset({
        ...initialData,
        orderbumps: initialData.orderbumps || [],
        image_url: initialData.image_url || "",
        status: initialData.status || "draft",
        internal_tag: (initialData as any).internal_tag ?? "",
        checkout_return_url: initialData.checkout_return_url || "",
        also_buy: (initialData as any).also_buy ?? false,
        is_kit: (initialData as any).is_kit ?? false,
        kit_product_ids: (initialData as any).kit_product_ids ?? [],
      });
      setCurrentAssets(initialData.assets || []);
      setDeletedAssetIds([]);
      setSelectedImageFile(null);
    } else {
      form.reset({
        name: "",
        price: 0,
        description: "",
        memberareaurl: "",
        orderbumps: [],
        image_url: "",
        status: "draft",
        internal_tag: "",
        checkout_return_url: "",
        also_buy: false,
        is_kit: false,
        kit_product_ids: [],
      });
      setCurrentAssets([]);
      setDeletedAssetIds([]);
      setSelectedFiles([]);
      setSelectedImageFile(null);
    }
  }, [initialData, form]);

  const handleFileChange = (files: File[]) => {
    setSelectedFiles(files);
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este arquivo?")) return;
    setCurrentAssets((prev) => prev.filter((a) => a.id !== assetId));
    setDeletedAssetIds((prev) => [...prev, assetId]);
  };

  const handleImageFileChange = (file: File | null) => {
    setSelectedImageFile(file);
  };

  const handleFormSubmit = (data: z.infer<typeof formSchema>) => {
    console.log("ProductEditTabs - Form data before submit:", data);
    console.log("ProductEditTabs - is_kit value:", data.is_kit);
    console.log("ProductEditTabs - kit_product_ids:", data.kit_product_ids);

    onSubmit(data, selectedFiles, deletedAssetIds, selectedImageFile, initialData?.image_url ?? null);
  };

  return (
    <div className="flex flex-col">
      <Tabs defaultValue="details" className="flex flex-col">
        <TabsList className="grid w-full grid-cols-4 sticky top-0 z-20 bg-white border-b p-2">
          <TabsTrigger value="details">Detalhes</TabsTrigger>
          <TabsTrigger value="kit" className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            Kit
            {isKit && (
              <span className="ml-1 bg-orange-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                ✓
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="order-bumps">Order Bumps</TabsTrigger>
          <TabsTrigger value="files" disabled={!initialData}>
            PDFs
          </TabsTrigger>
        </TabsList>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleFormSubmit)} className="flex flex-col">
            <div className="p-4 md:p-6 space-y-4">
              <TabsContent value="details">
                <ProductDetailsTab
                  form={form}
                  isLoading={isLoading}
                  onImageFileChange={handleImageFileChange}
                  initialImageUrl={initialData?.image_url}
                />
              </TabsContent>

              <TabsContent value="kit">
                <ProductKitTab
                  form={form}
                  isLoading={isLoading}
                  currentProductId={initialData?.id}
                />
              </TabsContent>

              <TabsContent value="order-bumps">
                <ProductOrderBumpsTab
                  form={form}
                  isLoading={isLoading}
                  currentProductId={initialData?.id}
                />
              </TabsContent>

              <TabsContent value="files">
                <p className="text-sm text-red-500 mb-4">
                  A gestão de arquivos para produtos existentes deve ser feita através do botão
                  "Materiais" na tabela principal. Esta aba é apenas para upload inicial.
                </p>
                <ProductAssetsTab
                  initialAssets={currentAssets}
                  onFileChange={handleFileChange}
                  onDeleteAsset={handleDeleteAsset}
                  isLoading={isLoading}
                />
              </TabsContent>
            </div>

            <DialogFooter className="sticky bottom-0 z-20 bg-white border-t p-4 md:p-6">
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
    </div>
  );
};

export default ProductEditTabs;
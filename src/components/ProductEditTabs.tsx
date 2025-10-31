"use client";

import React, { useMemo } from "react";
import { UseFormReturn, FormProvider, useForm } from "react-hook-form";
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Product } from "@/types";
import ProductDetailsTab from "./ProductDetailsTab";
import ProductOrderBumpsTab from "./ProductOrderBumpsTab";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/SessionContextProvider";

const productFormSchema = z.object({
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

type ProductForm = z.infer<typeof productFormSchema>;

interface ProductEditTabsProps {
  initialData?: Product & { assets?: any };
  onSubmit: (data: ProductForm, imageFile: File | null) => void;
  onCancel: () => void;
  isLoading: boolean;
}

const ProductEditTabs = ({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
}: ProductEditTabsProps) => {
  // Criar um form real para edição (Detalhes + Order Bumps)
  const defaultValues: ProductForm = useMemo(
    () => ({
      name: initialData?.name ?? "",
      price: initialData?.price ?? 0,
      description: initialData?.description ?? "",
      memberareaurl: initialData?.memberareaurl ?? "",
      orderbumps: initialData?.orderbumps ?? [],
      image_url: initialData?.image_url ?? "",
      status: (initialData?.status ?? "draft") as any,
      tag: initialData?.tag ?? "",
      return_url: initialData?.return_url ?? "",
    }),
    [initialData]
  );

  const methods = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: "onChange",
  });

  const onImageFileChange = (_file: File | null) => {
    // Placeholder: a função de upload real pode ser passada pelo filho, se necessário
  };

  const handleSubmit = async (data: ProductForm) => {
    onSubmit(data, null);
  };

  return (
    <FormProvider {...methods}>
      <Tabs defaultValue="details" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="details">Detalhes do Produto</TabsTrigger>
          <TabsTrigger value="order-bumps">Order Bumps</TabsTrigger>
        </TabsList>

        <ProductDetailsTab
          form={methods as any}
          isLoading={isLoading}
          onImageFileChange={onImageFileChange}
          initialImageUrl={initialData?.image_url ?? ""}
        />
        <TabsContent value="order-bumps">
          <ProductOrderBumpsTab form={methods as any} isLoading={isLoading} currentProductId={initialData?.id} />
        </TabsContent>
      </Tabs>
    </FormProvider>
  );
};

export default ProductEditTabs;
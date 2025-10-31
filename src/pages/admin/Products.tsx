"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Edit, Trash2, PlusCircle, Link as LinkIcon, Loader2, FileText } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import ProductEditTabs from "@/components/ProductEditTabs";
import { Product, ProductAsset } from "@/types";
import { useSession } from "@/components/SessionContextProvider";
import * as z from "zod";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ProductAssetManager from "@/components/admin/ProductAssetManager";
import ProductTagModal from "@/components/admin/ProductTagModal";
import { Badge } from "@/components/ui/badge";

type ProductWithAssets = Product & { assets?: ProductAsset[]; assetCount?: number };

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(),
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")),
  status: z.enum(["draft", "ativo", "inativo"]),
  internal_tag: z.string().optional(),
});

interface ProductRowForTable extends ProductWithAssets {}

const Products = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [products, setProducts] = useState<ProductWithAssets[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductWithAssets | undefined>(undefined);

  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [assetManagementProduct, setAssetManagementProduct] = useState<Product | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Modal de tag do produto
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagModalProduct, setTagModalProduct] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingProducts(false);
      return;
    }
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*, product_assets(id)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Erro ao carregar produtos: " + error.message);
      console.error("Error fetching products:", error);
      setProducts([]);
    } else {
      const mapped = (data || []).map((p: any) => ({
        ...(p as Product),
        assets: (p.product_assets ?? []) as ProductAsset[],
        assetCount: (p.product_assets ?? []).length,
      })) as ProductWithAssets[];
      setProducts(mapped);
    }
    setIsLoadingProducts(false);
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchProducts();
    } else if (!isSessionLoading && !user) {
      setIsLoadingProducts(false);
    }
  }, [user, isSessionLoading, fetchProducts]);

  const handleCreateProduct = () => {
    setEditingProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEditProduct = async (productId: string) => {
    const { data, error } = await supabase
      .from("products")
      .select("*, product_assets(*)")
      .eq("id", productId)
      .single();

    if (error || !data) {
      showError("Erro ao carregar detalhes do produto para edição.");
      console.error("Error fetching product for edit:", error);
      return;
    }

    setEditingProduct(data as ProductWithAssets);
    setIsModalOpen(true);
  };

  const handleOpenAssetManager = (product: Product & { assetCount: number }) => {
    setAssetManagementProduct(product);
    setIsAssetModalOpen(true);
  };

  const handleSaveProduct = async (
    formData: z.infer<typeof formSchema> & { status: Product["status"] },
    files: File[],
    deletedAssetIds: string[],
    imageFile: File | null,
    oldImageUrl: string | null
  ) => {
    setIsSubmitting(true);
    let hasErrors = false;
    const errorMessages: string[] = [];

    const productData = {
      ...formData,
      user_id: user?.id,
    };

    let currentProductId = editingProduct?.id;
    let newImageUrl = formData.image_url;

    // Upload/remoção de imagem
    if (imageFile && user?.id) {
      const fileExtension = imageFile.name.split(".").pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, imageFile, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        errorMessages.push(`Erro ao fazer upload da imagem: ${uploadError.message}`);
        hasErrors = true;
      } else {
        newImageUrl = supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;
        if (oldImageUrl && oldImageUrl !== newImageUrl) {
          const oldPath = oldImageUrl.split("product-images/")[1];
          if (oldPath) {
            await supabase.storage.from("product-images").remove([oldPath]);
          }
        }
      }
    } else if (!imageFile && !formData.image_url && oldImageUrl) {
      const oldPath = oldImageUrl.split("product-images/")[1];
      if (oldPath) {
        await supabase.storage.from("product-images").remove([oldPath]);
      }
      newImageUrl = null as any;
    }
    (productData as any).image_url = newImageUrl;

    // Criar/Atualizar produto
    if (editingProduct) {
      const { error } = await supabase.from("products").update(productData).eq("id", editingProduct.id);
      if (error) {
        errorMessages.push("Erro ao atualizar produto: " + error.message);
        hasErrors = true;
      } else {
        showSuccess("Detalhes do produto atualizados!");
        currentProductId = editingProduct.id;
      }
    } else {
      const { data, error } = await supabase.from("products").insert(productData).select("id").single();
      if (error || !data) {
        errorMessages.push("Erro ao criar produto: " + error?.message);
        hasErrors = true;
      } else {
        showSuccess("Produto criado com sucesso!");
        currentProductId = data.id;
      }
    }

    if (hasErrors && !currentProductId) {
      setIsSubmitting(false);
      showError("Ocorreram erros durante o salvamento:\n" + errorMessages.join("\n"));
      return;
    }

    // Upload de assets (PDF)
    if (files.length > 0 && currentProductId && user?.id) {
      for (const file of files) {
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
        const filePath = `${user.id}/${currentProductId}/${sanitizedFileName}-${Date.now()}`;
        const { error: uploadError } = await supabase.storage.from("product-assets").upload(filePath, file);

        if (uploadError) {
          errorMessages.push(`Erro ao fazer upload do arquivo ${file.name}: ${uploadError.message}`);
          hasErrors = true;
        } else {
          const { error: assetInsertError } = await supabase
            .from("product_assets")
            .insert({ product_id: currentProductId, file_name: file.name, storage_path: filePath });
          if (assetInsertError) {
            errorMessages.push(`Erro ao registrar asset ${file.name} no banco de dados: ${assetInsertError.message}`);
            hasErrors = true;
          }
        }
      }
    }

    // Exclusão de assets se necessário
    if (deletedAssetIds.length > 0 && editingProduct) {
      const assetsToDeletePaths: string[] = [];
      for (const assetId of deletedAssetIds) {
        const asset = editingProduct.assets?.find((a) => a.id === assetId);
        if (asset) assetsToDeletePaths.push(asset.storage_path);
      }
      if (assetsToDeletePaths.length > 0) {
        await supabase.storage.from("product-assets").remove(assetsToDeletePaths);
      }
      await supabase.from("product_assets").delete().in("id", deletedAssetIds);
    }

    if (hasErrors) {
      showError("Ocorreram erros durante o salvamento:\n" + errorMessages.join("\n"));
    } else {
      showSuccess("Produto e arquivos salvos com sucesso!");
    }

    await fetchProducts();
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  // Tag: abrir modal
  const openTagModalForProduct = (product: Product) => {
    setTagModalProduct(product);
    setIsTagModalOpen(true);
  };

  // Tag: salvar (atualiza localmente sem refetch)
  const handleTagSaved = (newTag: string | null) => {
    if (!tagModalProduct) return;
    setProducts((prev) =>
      prev.map((p) => (p.id === tagModalProduct.id ? { ...p, internal_tag: newTag ?? undefined } as ProductWithAssets : p))
    );
  };

  // Excluir produto (mantém comportamento anterior)
  const handleConfirmDelete = (id: string) => {
    setProductToDelete(id);
    setIsConfirmDeleteOpen(true);
  };

  const tagPlaceholder = "Sem tag";

  const getStatusBadge = (status: Product["status"]) => {
    switch (status) {
      case "ativo":
        return <Badge className="bg-green-500 text-white">Ativo</Badge>;
      case "inativo":
        return <Badge variant="secondary">Inativo</Badge>;
      case "draft":
      default:
        return <Badge variant="outline">Rascunho</Badge>;
    }
  };

  if (isSessionLoading || isLoadingProducts) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Gerenciar Produtos</h1>
        </div>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white" onClick={handleCreateProduct}>
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-gray-600 text-lg mt-10">
          Nenhum produto encontrado. Crie um novo produto para começar!
        </p>
      ) : (
        <div className="rounded-md border bg-white shadow-lg">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tag Interna</TableHead>
                <TableHead>Bumps</TableHead>
                <TableHead>Materiais</TableHead>
                <TableHead className="text-right w-[180px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium flex items-center gap-3">
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-10 h-10 object-cover rounded-md shrink-0"
                      />
                    )}
                    <div className="truncate max-w-[180px]">
                      {product.name}
                      <p className="text-xs text-gray-500">{product.id}</p>
                    </div>
                  </TableCell>

                  <TableCell>R$ {product.price.toFixed(2)}</TableCell>

                  <TableCell>{getStatusBadge(product.status)}</TableCell>

                  <TableCell>
                    <div className="flex items-center gap-2">
                      <button
                        className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-xs"
                        onClick={() => openTagModalForProduct(product)}
                        title="Editar tag deste produto"
                      >
                        {product.internal_tag ?? tagPlaceholder}
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openTagModalForProduct(product)}
                        className="text-blue-600 hover:text-blue-700"
                        title="Adicionar/editar tag"
                      >
                        <PlusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>

                  <TableCell>{product.orderbumps?.length ?? 0}</TableCell>

                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setAssetManagementProduct(product);
                        setIsAssetModalOpen(true);
                      }}
                      className="flex items-center gap-1"
                    >
                      <FileText className="h-4 w-4" />
                      {product.assetCount ?? 0} Arquivo(s)
                    </Button>
                  </TableCell>

                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditProduct(product.id)}
                      className="mr-1 text-gray-600 hover:text-orange-500"
                      title="Editar Produto"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleConfirmDelete(product.id)}
                      className="text-red-500 hover:text-red-700"
                      title="Excluir Produto"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal de edição de produto */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl p-6">
          <ProductEditTabs
            initialData={editingProduct}
            onSubmit={handleSaveProduct}
            onCancel={() => setIsModalOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de materiais do produto */}
      <Dialog open={isAssetModalOpen} onOpenChange={setIsAssetModalOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <ProductAssetManager
            productId={assetManagementProduct?.id ?? ""}
            productName={assetManagementProduct?.name ?? ""}
            onAssetsUpdated={fetchProducts}
          />
        </DialogContent>
      </Dialog>

      {/* Modal de tag por produto - sem refetch ao salvar */}
      {tagModalProduct && (
        <ProductTagModal
          open={isTagModalOpen}
          onClose={() => setIsTagModalOpen(false)}
          product={tagModalProduct}
          onSaved={handleTagSaved}
        />
      )}

      {/* Confirmação de exclusão (mantém comportamento existente) */}
      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        onClose={() => setIsConfirmDeleteOpen(false)}
        title="Confirmar Exclusão do Produto"
        description="Tem certeza que deseja excluir este produto? Todos os dados, incluindo arquivos e imagem principal, serão removidos permanentemente."
        confirmText="Sim, Excluir Produto"
        isDestructive
        isLoading={false}
      />
    </div>
  );
};

export default Products;
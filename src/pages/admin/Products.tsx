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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Trash2, PlusCircle, Link as LinkIcon, Loader2, FileText, Eye } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import ProductEditTabs from "@/components/ProductEditTabs";
import { Product, ProductAsset } from "@/types";
import { useSession } from "@/components/SessionContextProvider";
import * as z from "zod";

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

const Products = () => {
  const { user, isLoading: isSessionLoading } = useSession();

  const [products, setProducts] = useState<(Product & { assets?: ProductAsset[], assetCount: number })[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);

  // Edit/Create modal state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(Product & { assets?: ProductAsset[] }) | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation state
  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  // Fetch products for admin view
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
      const enriched = (data || []).map((p) => ({
        ...p,
        assets: (p as any).product_assets as ProductAsset[],
        assetCount: ((p as any).product_assets?.length) ?? 0,
      }));
      setProducts(enriched as (Product & { assets?: ProductAsset[]; assetCount: number })[]);
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

  // Open new product editor (creating)
  const handleCreateProduct = () => {
    setEditingProduct(undefined);
    setIsEditModalOpen(true);
  };

  // Open existing product for editing
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

    setEditingProduct(data as Product & { assets?: ProductAsset[] });
    setIsEditModalOpen(true);
  };

  // Create or update product handler wired to ProductEditTabs
  const handleEditSubmit = async (formData: z.infer<typeof formSchema>, imageFile: File | null) => {
    setIsSubmitting(true);
    try {
      if (!editingProduct) {
        // Create new product
        const payload: any = {
          user_id: user?.id,
          name: formData.name,
          price: formData.price,
          description: formData.description ?? null,
          memberareaurl: formData.memberareaurl ?? null,
          orderbumps: formData.orderbumps ?? null,
          image_url: formData.image_url ?? null,
          status: formData.status,
          tag: formData.tag ?? null,
          return_url: formData.return_url ?? null,
        };
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        const { data: newProduct, error } = await supabase.from("products").insert(payload).select("*").single();
        if (error) {
          showError("Erro ao criar produto: " + error.message);
          console.error("Create product error:", error);
        } else {
          showSuccess("Produto criado com sucesso!");
          setIsEditModalOpen(false);
          fetchProducts();
        }
      } else {
        // Update existing product
        const payload: any = {
          name: formData.name,
          price: formData.price,
          description: formData.description ?? null,
          memberareaurl: formData.memberareaurl ?? null,
          orderbumps: formData.orderbumps ?? null,
          image_url: formData.image_url ?? null,
          status: formData.status,
          tag: formData.tag ?? null,
          return_url: formData.return_url ?? null,
        };
        Object.keys(payload).forEach((k) => payload[k] === undefined && delete payload[k]);

        const { data: updated, error } = await supabase.from("products").update(payload).eq("id", editingProduct!.id).select("*").single();
        if (error) {
          showError("Erro ao atualizar produto: " + error.message);
        } else {
          showSuccess("Produto atualizado com sucesso!");
          setIsEditModalOpen(false);
          fetchProducts();
        }
      }
    } catch (err: any) {
      console.error("Erro no submit de edição/criação:", err);
      showError("Erro ao salvar produto.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete product
  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      const { error } = await supabase.from("products").delete().eq("id", productToDelete);
      if (error) {
        showError("Erro ao excluir produto: " + error.message);
      } else {
        showSuccess("Produto excluído com sucesso!");
        fetchProducts();
      }
    } catch (err: any) {
      showError("Erro ao excluir produto.");
    } finally {
      setProductToDelete(null);
    }
  };

  // Delete confirmation flow
  const confirmDelete = (id: string) => {
    setProductToDelete(id);
  };

  // Reutilizar link de checkout como bonus (opcional)
  const handleGenerateCheckoutLink = (productId: string) => {
    const checkoutUrl = `${window.location.origin}/checkout/${productId}`;
    navigator.clipboard.writeText(checkoutUrl)
      .then(() => showSuccess("Link do checkout copiado!"))
      .catch(() => showError("Falha ao copiar o link."));
  };

  // UI de status (simplificada)
  const getTagForDisplay = (p: Product) => p.tag ?? "—";

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
        <h1 className="text-3xl font-bold">Gerenciar Produtos</h1>
        <Button onClick={handleCreateProduct} className="bg-orange-500 hover:bg-orange-600 text-white">
          <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Produto
        </Button>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-gray-600 text-lg mt-10">Nenhum produto encontrado. Crie um novo produto para começar!</p>
      ) : (
        <div className="rounded-md border bg-white shadow-lg">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Tag</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Materiais</TableHead>
                <TableHead className="text-right w-[240px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id} className="hover:bg-gray-50">
                  <TableCell className="font-medium flex items-center gap-3">
                    {product.image_url && (
                      <img src={product.image_url} alt={product.name} className="w-10 h-10 object-cover rounded-md" />
                    )}
                    <div className="truncate max-w-[150px]">{product.name}</div>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">{getTagForDisplay(product)}</TableCell>
                  <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-gray-600">{product.assetCount ?? 0} arquivo(s)</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleEditProduct(product.id)} className="mr-1 text-gray-600 hover:text-orange-500" title="Editar Produto">
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleGenerateCheckoutLink(product.id)} className="mr-1" title="Copiar Link de Checkout">
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => confirmDelete(product.id)} className="text-red-500 hover:text-red-700" title="Excluir Produto">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialog de edição / criação */}
      <Dialog open={isEditModalOpen} onOpenChange={(open) => setIsEditModalOpen(!!open)}>
        <DialogContent className="sm:max-w-4xl p-0">
          <ProductEditTabs
            initialData={editingProduct}
            onSubmit={handleEditSubmit}
            onCancel={() => setIsEditModalOpen(false)}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <Dialog open={!!productToDelete} onOpenChange={(open) => {
        if (!open) setProductToDelete(null);
      }}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogHeader>
            <DialogTitle>Excluir Produto</DialogTitle>
          </DialogHeader>
          <div className="mt-2 mb-4 text-sm text-gray-700">
            Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setProductToDelete(null)}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteProduct} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Products;
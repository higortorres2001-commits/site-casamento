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
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Edit, Trash2, Loader2, FileText, Copy } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import ProductEditTabs from "@/components/ProductEditTabs";
import { Product, ProductAsset } from "@/types";
import { useSession } from "@/components/SessionContextProvider";
import * as z from "zod";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import ProductAssetManager from "@/components/admin/ProductAssetManager";
import ProductTagModal from "@/components/admin/ProductTagModal";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

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

  const handleCancelEdit = () => {
    // Simplesmente fecha o modal sem fazer nada
    setIsModalOpen(false);
    setEditingProduct(undefined);
  };

  // Resto do código permanece igual...

  return (
    <div className="container mx-auto p-4">
      {/* ... outros elementos ... */}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-4xl lg:max-w-5xl p-0 max-h-[90vh] overflow-y-auto">
          <ProductEditTabs
            initialData={editingProduct}
            onSubmit={handleSaveProduct}
            onCancel={handleCancelEdit}
            isLoading={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      {/* ... outros elementos ... */}
    </div>
  );
};

export default Products;
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Edit, Trash2, PlusCircle, FileText, Link as LinkIcon, Loader2 } from "lucide-react";
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
  orderbumps: z.array(z.string()).optional(), // Array of product IDs
  image_url: z.string().url("URL da imagem inválida").optional().or(z.literal("")), // Adicionado image_url
});

const Products = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true); // Renomeado para clareza
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<(Product & { assets?: ProductAsset[] }) | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProducts = useCallback(async () => {
    if (!user?.id) {
      setIsLoadingProducts(false);
      return;
    }
    setIsLoadingProducts(true);
    const { data, error } = await supabase
      .from("products")
      .select("*, product_assets(*)")
      .eq("user_id", user.id) // Usar user.id diretamente após a verificação
      .order("created_at", { ascending: false });

    if (error) {
      showError("Erro ao carregar produtos: " + error.message);
      console.error("Error fetching products:", error);
    } else {
      setProducts(data || []);
    }
    setIsLoadingProducts(false);
  }, [user]); // Depende de user

  useEffect(() => {
    if (!isSessionLoading) {
      if (user) {
        fetchProducts();
      } else {
        // Se a sessão carregou mas não há usuário, parar o carregamento interno.
        // O SessionContextProvider cuidará do redirecionamento para o login se não for uma rota pública.
        setIsLoadingProducts(false); 
      }
    }
  }, [user, isSessionLoading, fetchProducts]); // Depende de user, isSessionLoading e fetchProducts

  const handleCreateProduct = () => {
    setEditingProduct(undefined);
    setIsModalOpen(true);
  };

  const handleEditProduct = (product: Product & { assets?: ProductAsset[] }) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const handleSaveProduct = async (
    formData: z.infer<typeof formSchema>,
    files: File[],
    deletedAssetIds: string[],
    imageFile: File | null, // New parameter
    oldImageUrl: string | null // New parameter
  ) => {
    setIsSubmitting(true);

    const productData = {
      ...formData,
      user_id: user?.id,
    };

    let currentProductId = editingProduct?.id;
    let newImageUrl = formData.image_url; // Start with the URL from the form (could be manual or empty)

    // Handle image upload if a new file is selected
    if (imageFile && user?.id) {
      const fileExtension = imageFile.name.split('.').pop();
      const filePath = `${user.id}/${crypto.randomUUID()}.${fileExtension}`; // Unique filename
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        showError(`Erro ao fazer upload da imagem: ${uploadError.message}`);
        console.error("Error uploading image:", uploadError);
        setIsSubmitting(false);
        return;
      }
      newImageUrl = supabase.storage.from("product-images").getPublicUrl(filePath).data.publicUrl;
      showSuccess("Imagem do produto enviada com sucesso!");

      // If there was an old image and a new one is uploaded, delete the old one
      if (oldImageUrl && oldImageUrl !== newImageUrl) {
        const oldPath = oldImageUrl.split('product-images/')[1]; // Extract path from public URL
        if (oldPath) {
          const { error: deleteOldImageError } = await supabase.storage
            .from('product-images')
            .remove([oldPath]);
          if (deleteOldImageError) {
            console.warn("Could not delete old product image from storage:", deleteOldImageError.message);
          }
        }
      }
    } else if (!imageFile && !formData.image_url && oldImageUrl) {
      // If no new file, and image_url field is cleared, and there was an old image, delete it
      const oldPath = oldImageUrl.split('product-images/')[1];
      if (oldPath) {
        const { error: deleteOldImageError } = await supabase.storage
          .from('product-images')
          .remove([oldPath]);
        if (deleteOldImageError) {
          console.warn("Could not delete old product image from storage (cleared field):", deleteOldImageError.message);
        }
      }
      newImageUrl = null; // Ensure image_url is null in DB
    }

    // Update productData with the new image URL
    productData.image_url = newImageUrl;

    if (editingProduct) {
      // Update existing product
      const { error } = await supabase
        .from("products")
        .update(productData)
        .eq("id", editingProduct.id);
      if (error) {
        showError("Erro ao atualizar produto: " + error.message);
        console.error("Error updating product:", error);
        setIsSubmitting(false);
        return;
      }
      showSuccess("Produto atualizado com sucesso!");
      currentProductId = editingProduct.id; // Ensure currentProductId is set for asset uploads
    } else {
      // Create new product
      const { data, error } = await supabase
        .from("products")
        .insert(productData)
        .select("id")
        .single();
      if (error || !data) {
        showError("Erro ao criar produto: " + error.message);
        console.error("Error creating product:", error);
        setIsSubmitting(false);
        return;
      }
      showSuccess("Produto criado com sucesso!");
      currentProductId = data.id;
    }

    // Handle file uploads (PDFs)
    if (files.length > 0 && currentProductId && user?.id) {
      for (const file of files) {
        const filePath = `${user.id}/${currentProductId}/${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("product-assets")
          .upload(filePath, file);

        if (uploadError) {
          showError(`Erro ao fazer upload do arquivo ${file.name}: ${uploadError.message}`);
          console.error("Error uploading file:", uploadError);
        } else {
          // Insert asset record into product_assets table
          const { error: assetInsertError } = await supabase
            .from("product_assets")
            .insert({
              product_id: currentProductId,
              file_name: file.name,
              storage_path: filePath,
            });
          if (assetInsertError) {
            showError(`Erro ao registrar asset ${file.name}: ${assetInsertError.message}`);
            console.error("Error inserting asset record:", assetInsertError);
          }
        }
      }
      showSuccess("Arquivos enviados com sucesso!");
    }

    // Handle asset deletions (PDFs)
    if (deletedAssetIds.length > 0) {
      const assetsToDeletePaths: string[] = [];
      for (const assetId of deletedAssetIds) {
        const asset = editingProduct?.assets?.find(a => a.id === assetId);
        if (asset) {
          assetsToDeletePaths.push(asset.storage_path);
        }
      }

      if (assetsToDeletePaths.length > 0) {
        const { error: deleteStorageError } = await supabase.storage
          .from('product-assets')
          .remove(assetsToDeletePaths);

        if (deleteStorageError) {
          showError("Erro ao excluir arquivos do storage: " + deleteStorageError.message);
          console.error("Error deleting files from storage:", deleteStorageError);
          // Continue with database deletion even if storage fails, to avoid orphaned records
        } else {
          showSuccess("Arquivos do produto excluídos do storage.");
        }
      }

      const { error: deleteDbError } = await supabase
        .from('product_assets')
        .delete()
        .in('id', deletedAssetIds);

      if (deleteDbError) {
        showError("Erro ao excluir registros de arquivos do banco de dados: " + deleteDbError.message);
        console.error("Error deleting asset records:", deleteDbError);
      } else {
        showSuccess("Registros de arquivos excluídos do banco de dados.");
      }
    }

    fetchProducts();
    setIsModalOpen(false);
    setIsSubmitting(false);
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este produto e todos os seus arquivos?")) return;

    setIsSubmitting(true);

    // First, fetch assets to delete from storage
    const { data: assetsToDelete, error: fetchAssetsError } = await supabase
      .from('product_assets')
      .select('storage_path')
      .eq('product_id', id);

    if (fetchAssetsError) {
      showError("Erro ao buscar assets para exclusão: " + fetchAssetsError.message);
      console.error("Error fetching assets for deletion:", fetchAssetsError);
      setIsSubmitting(false);
      return;
    }

    if (assetsToDelete && assetsToDelete.length > 0) {
      const paths = assetsToDelete.map(asset => asset.storage_path);
      const { error: deleteStorageError } = await supabase.storage
        .from('product-assets')
        .remove(paths);

      if (deleteStorageError) {
        showError("Erro ao excluir arquivos do storage: " + deleteStorageError.message);
        console.error("Error deleting files from storage:", deleteStorageError);
        // Continue with database deletion even if storage fails, to avoid orphaned records
      } else {
          showSuccess("Arquivos do produto excluídos do storage.");
      }
    }

    // Also delete the main product image if it exists
    const productToDelete = products.find(p => p.id === id);
    if (productToDelete?.image_url) {
      const imagePath = productToDelete.image_url.split('product-images/')[1];
      if (imagePath) {
        const { error: deleteImageError } = await supabase.storage
          .from('product-images')
          .remove([imagePath]);
        if (deleteImageError) {
          console.warn("Could not delete product image from storage during product deletion:", deleteImageError.message);
        } else {
          showSuccess("Imagem principal do produto excluída do storage.");
        }
      }
    }

    // Then, delete the product (this will cascade delete assets from product_assets table due to RLS)
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      showError("Erro ao excluir produto: " + error.message);
      console.error("Error deleting product:", error);
    } else {
      showSuccess("Produto excluído com sucesso!");
      fetchProducts();
    }
    setIsSubmitting(false);
  };

  const handleDownloadAsset = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('product-assets')
      .download(storagePath);

    if (error) {
      showError("Erro ao baixar arquivo: " + error.message);
      console.error("Error downloading file:", error);
      return;
    }

    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleGenerateCheckoutLink = (productId: string) => {
    const checkoutUrl = `${window.location.origin}/checkout/${productId}`;
    navigator.clipboard.writeText(checkoutUrl)
      .then(() => showSuccess("Link do checkout copiado!"))
      .catch(() => showError("Falha ao copiar o link."));
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
        <h1 className="text-3xl font-bold">Gerenciar Produtos</h1>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogTrigger asChild>
            <Button
              className="bg-orange-500 hover:bg-orange-600 text-white"
              onClick={handleCreateProduct}
            >
              <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Novo Produto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"> {/* Adicionado max-h e overflow-y-auto */}
            <DialogHeader>
              <DialogTitle>{editingProduct ? "Editar Produto" : "Criar Novo Produto"}</DialogTitle>
            </DialogHeader>
            <ProductEditTabs
              initialData={editingProduct}
              onSubmit={handleSaveProduct}
              onCancel={() => setIsModalOpen(false)}
              isLoading={isSubmitting}
            />
          </DialogContent>
        </Dialog>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-gray-600 text-lg mt-10">Nenhum produto encontrado. Crie um novo produto para começar!</p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-28">ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Imagem</TableHead> {/* New column for image */}
                <TableHead>Arquivos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell className="w-28 truncate text-xs">{product.id}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>R$ {product.price.toFixed(2)}</TableCell>
                  <TableCell className="max-w-xs truncate">{product.description || "N/A"}</TableCell>
                  <TableCell>
                    {product.image_url ? (
                      <img src={product.image_url} alt={product.name} className="w-12 h-12 object-cover rounded-md" />
                    ) : (
                      "N/A"
                    )}
                  </TableCell>
                  <TableCell>
                    {product.assets && product.assets.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {product.assets.map((asset) => (
                          <Button
                            key={asset.id}
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadAsset(asset.storage_path, asset.file_name)}
                            className="flex items-center gap-1"
                          >
                            <FileText className="h-3 w-3" /> {asset.file_name}
                          </Button>
                        ))}
                      </div>
                    ) : (
                      "Nenhum arquivo"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditProduct(product)}
                      className="mr-2"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleGenerateCheckoutLink(product.id)}
                      className="mr-2 text-orange-500 hover:text-orange-600"
                    >
                      <LinkIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="text-red-500 hover:text-red-700"
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
    </div>
  );
};

export default Products;
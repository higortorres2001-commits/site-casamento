"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductAsset } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, FileText, X, Download } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { Card } from "@/components/ui/card";

interface ProductAssetManagerProps {
  productId: string;
  productName: string;
  onAssetsUpdated: () => void;
}

const ProductAssetManager = ({
  productId,
  productName,
  onAssetsUpdated,
}: ProductAssetManagerProps) => {
  const { user } = useSession();
  const [assets, setAssets] = useState<ProductAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<ProductAsset | null>(null);

  const fetchAssets = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("product_assets")
      .select("*")
      .eq("product_id", productId)
      .order("created_at", { ascending: false });

    if (error) {
      showError("Erro ao carregar materiais: " + error.message);
      console.error("Error fetching assets:", error);
      setAssets([]);
    } else {
      // Generate signed URLs for display/download
      const assetsWithSignedUrls = await Promise.all(
        (data || []).map(async (asset) => {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('product-assets')
            .createSignedUrl(asset.storage_path, 3600); // 1 hour validity

          if (signedUrlError) {
            console.error(`Error generating signed URL for asset ${asset.id}:`, signedUrlError.message);
            return { ...asset, signed_url: null };
          }
          return { ...asset, signed_url: signedUrlData?.signedUrl || null };
        })
      );
      setAssets(assetsWithSignedUrls);
    }
    setIsLoading(false);
  }, [productId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleUploadFiles = async () => {
    if (selectedFiles.length === 0 || !user?.id) return;

    setIsUploading(true);
    let hasErrors = false;
    const errorMessages: string[] = [];

    for (const file of selectedFiles) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        errorMessages.push(`O arquivo ${file.name} não é um PDF e foi ignorado.`);
        continue;
      }

      const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
      const filePath = `${user.id}/${productId}/${sanitizedFileName}-${Date.now()}`; // Ensure unique path
      
      const { error: uploadError } = await supabase.storage
        .from("product-assets")
        .upload(filePath, file);

      if (uploadError) {
        errorMessages.push(`Erro ao fazer upload do arquivo ${file.name}: ${uploadError.message}`);
        hasErrors = true;
      } else {
        const { error: assetInsertError } = await supabase
          .from("product_assets")
          .insert({
            product_id: productId,
            file_name: file.name,
            storage_path: filePath,
          });
        if (assetInsertError) {
          errorMessages.push(`Erro ao registrar asset ${file.name} no banco de dados: ${assetInsertError.message}`);
          hasErrors = true;
        }
      }
    }

    if (hasErrors) {
      showError("Ocorreram erros durante o upload:\n" + errorMessages.join("\n"));
    } else {
      showSuccess(`${selectedFiles.length} arquivo(s) enviado(s) com sucesso!`);
    }

    setSelectedFiles([]);
    setIsUploading(false);
    fetchAssets();
    onAssetsUpdated();
  };

  const handleConfirmDelete = (asset: ProductAsset) => {
    setAssetToDelete(asset);
    setIsConfirmOpen(true);
  };

  const handleDeleteAsset = async (confirmed: boolean) => {
    setIsConfirmOpen(false);
    if (!confirmed || !assetToDelete) {
      setAssetToDelete(null);
      return;
    }

    setIsLoading(true);
    const asset = assetToDelete;

    // 1. Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from('product-assets')
      .remove([asset.storage_path]);

    if (deleteStorageError) {
      showError("Erro ao excluir arquivo do storage: " + deleteStorageError.message);
      console.error("Error deleting file from storage:", deleteStorageError);
      setIsLoading(false);
      setAssetToDelete(null);
      return;
    }

    // 2. Delete from database
    const { error: deleteDbError } = await supabase
      .from('product_assets')
      .delete()
      .eq('id', asset.id);

    if (deleteDbError) {
      showError("Erro ao excluir registro do banco de dados: " + deleteDbError.message);
      console.error("Error deleting asset record:", deleteDbError);
    } else {
      showSuccess(`Arquivo "${asset.file_name}" excluído com sucesso!`);
    }

    setAssetToDelete(null);
    fetchAssets();
    onAssetsUpdated();
  };

  const handleDownloadAsset = (signedUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Download de "${fileName}" iniciado!`);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Materiais de {productName}</h2>

      {/* Upload Section */}
      <Card className="p-4 border-dashed border-2 border-gray-300 bg-gray-50">
        <h3 className="text-lg font-semibold mb-3">Adicionar Novos Arquivos (PDF)</h3>
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileChange}
            disabled={isUploading}
            className="flex-1"
          />
          <Button
            onClick={handleUploadFiles}
            disabled={isUploading || selectedFiles.length === 0}
            className="bg-blue-500 hover:bg-blue-600 text-white shrink-0"
          >
            {isUploading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              "Fazer Upload"
            )}
          </Button>
        </div>
        {selectedFiles.length > 0 && (
          <p className="text-sm text-gray-600 mt-2">
            {selectedFiles.length} arquivo(s) selecionado(s) para upload.
          </p>
        )}
      </Card>

      {/* Existing Assets List */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Arquivos Existentes ({assets.length})</h3>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : assets.length === 0 ? (
          <p className="text-gray-500 text-center py-4 border rounded-md bg-white">
            Nenhum material encontrado.
          </p>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="flex items-center justify-between p-3 border rounded-lg bg-white shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-5 w-5 text-gray-600 shrink-0" />
                  <span className="text-gray-800 truncate font-medium">{asset.file_name}</span>
                </div>
                <div className="flex gap-2 shrink-0">
                  {asset.signed_url ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDownloadAsset(asset.signed_url!, asset.file_name)}
                      className="text-blue-500 hover:bg-blue-50"
                    >
                      <Download className="h-4 w-4 mr-2" /> Baixar
                    </Button>
                  ) : (
                    <span className="text-red-500 text-sm">Link indisponível</span>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleConfirmDelete(asset)}
                    disabled={isUploading}
                    className="text-red-500 hover:bg-red-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={handleDeleteAsset}
        title={`Excluir Material: ${assetToDelete?.file_name}`}
        description="Tem certeza que deseja excluir este arquivo? Esta ação é irreversível e removerá o arquivo do storage."
        confirmText="Excluir Permanentemente"
        isDestructive
        isLoading={isLoading}
      />
    </div>
  );
};

export default ProductAssetManager;
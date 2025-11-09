"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, ProductAsset } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, FileText, ArrowLeft, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [product, setProduct] = useState<(Product & { assets?: ProductAsset[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentPdfName, setCurrentPdfName] = useState<string | null>(null);

  const fetchProductDetails = useCallback(async () => {
    if (!productId) {
      showError("ID do produto não fornecido.");
      navigate("/meus-produtos");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*, product_assets(*)")
      .eq("id", productId)
      .single();

    if (error || !data) {
      showError("Produto não encontrado ou erro ao carregar.");
      console.error("Error fetching product details:", error);
      navigate("/meus-produtos");
      return;
    }

    // Generate signed URLs for each asset
    if (data.product_assets && data.product_assets.length > 0) {
      const assetsWithSignedUrls = await Promise.all(
        data.product_assets.map(async (asset) => {
          const { data: signedUrlData, error: signedUrlError } = await supabase.storage
            .from('product-assets')
            .createSignedUrl(asset.storage_path, 3600); // URL válida por 1 hora

          if (signedUrlError) {
            console.error(`Error generating signed URL for asset ${asset.id}:`, signedUrlError.message);
            await supabase.from('logs').insert({
              level: 'error',
              context: 'client-product-details',
              message: `Failed to generate signed URL for asset ${asset.id}: ${signedUrlError.message}`,
              metadata: { userId: user?.id, productId, assetId: asset.id, storagePath: asset.storage_path, error: signedUrlError.message }
            });
            return { ...asset, signed_url: null }; // Return asset with null signed_url on error
          }
          return { ...asset, signed_url: signedUrlData?.signedUrl || null };
        })
      );
      setProduct({ ...data, product_assets: assetsWithSignedUrls });
    } else {
      setProduct(data);
    }
    setIsLoading(false);
  }, [productId, navigate, user]);

  useEffect(() => {
    fetchProductDetails();
  }, [fetchProductDetails]);

  const handleDownloadAsset = async (signedUrl: string, fileName: string) => {
    // For download, we can directly use the signed URL
    const link = document.createElement('a');
    link.href = signedUrl;
    link.download = fileName; // Suggest a filename
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showSuccess(`Download de "${fileName}" iniciado!`);
    await supabase.from('logs').insert({
      level: 'info',
      context: 'client-asset-download',
      message: 'Client downloaded product asset successfully.',
      metadata: { userId: user?.id, productId, fileName, signedUrl }
    });
  };

  const handleViewPdf = async (signedUrl: string, fileName: string) => {
    if (signedUrl) {
      setCurrentPdfUrl(signedUrl);
      setCurrentPdfName(fileName);
      setIsPdfViewerOpen(true);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'client-asset-view',
        message: 'Client viewed product asset successfully.',
        metadata: { userId: user?.id, productId, fileName, signedUrl }
      });
    } else {
      showError("Não foi possível obter o link de visualização do PDF.");
      await supabase.from('logs').insert({
        level: 'error',
        context: 'client-asset-view',
        message: 'Signed URL for PDF view was null or undefined.',
        metadata: { userId: user?.id, productId, fileName }
      });
    }
  };

  const handleClosePdfViewer = () => {
    setIsPdfViewerOpen(false);
    setCurrentPdfUrl(null);
    setCurrentPdfName(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl text-gray-600">Produto não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-3xl mx-auto mb-6">
        <Button
          variant="outline"
          onClick={() => navigate("/meus-produtos")}
          className="text-gray-600 hover:text-gray-800"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Meus Produtos
        </Button>
      </div>
      <Card className="bg-white rounded-xl shadow-lg max-w-3xl mx-auto p-6">
        <CardHeader className="pb-4">
          <CardTitle className="text-3xl font-bold text-gray-800">
            {product.name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {product.description && (
            <p className="text-gray-700 text-lg">{product.description}</p>
          )}

          <h2 className="text-2xl font-semibold text-gray-800 pt-4 border-t border-gray-200">
            Arquivos do Produto
          </h2>
          {product.product_assets && product.product_assets.length > 0 ? (
            <div className="space-y-4">
              {product.product_assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    <FileText className="h-6 w-6 text-blue-500" />
                    <span className="text-gray-700 font-medium">{asset.file_name}</span>
                  </div>
                  <div className="flex gap-2">
                    {asset.signed_url ? (
                      <>
                        <Button
                          variant="outline"
                          className="text-blue-500 hover:text-blue-700"
                          onClick={() => handleViewPdf(asset.signed_url!, asset.file_name)}
                        >
                          <Eye className="h-4 w-4 mr-2" /> Visualizar
                        </Button>
                        <Button
                          className="bg-orange-500 hover:bg-orange-600 text-white"
                          onClick={() => handleDownloadAsset(asset.signed_url!, asset.file_name)}
                        >
                          Baixar
                        </Button>
                      </>
                    ) : (
                      <span className="text-red-500 text-sm">Erro ao carregar arquivo</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">Nenhum arquivo disponível para este produto.</p>
          )}
        </CardContent>
      </Card>

      {/* PDF Viewer Dialog */}
      <Dialog open={isPdfViewerOpen} onOpenChange={handleClosePdfViewer}>
        <DialogContent className="sm:max-w-[800px] h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{currentPdfName || "Visualizador de PDF"}</DialogTitle>
            <DialogDescription>
              Visualizando o arquivo PDF.
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 w-full">
            {currentPdfUrl ? (
              <iframe src={currentPdfUrl} className="w-full h-full border-none" title="PDF Viewer"></iframe>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Não foi possível carregar o PDF.
              </div>
            )}
          </div>
          <div className="flex justify-end pt-4">
            <Button onClick={handleClosePdfViewer}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductDetails;
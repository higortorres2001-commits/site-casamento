"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, ProductAsset } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, FileText, ArrowLeft, Eye } from "lucide-react"; // Import Eye icon for view
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider"; // Import useSession

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useSession(); // Get user from session
  const [product, setProduct] = useState<(Product & { assets?: ProductAsset[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState(false);
  const [currentPdfUrl, setCurrentPdfUrl] = useState<string | null>(null);
  const [currentPdfName, setCurrentPdfName] = useState<string | null>(null);

  const fetchProductDetails = useCallback(async () => {
    if (!productId) {
      showError("ID do produto não fornecido.");
      navigate("/meus-produtos"); // Redirect if no product ID
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
      navigate("/meus-produtos"); // Redirect if product not found
      return;
    }
    setProduct(data);
    setIsLoading(false);
  }, [productId, navigate]);

  useEffect(() => {
    fetchProductDetails();
  }, [fetchProductDetails]);

  const handleDownloadAsset = async (storagePath: string, fileName: string) => {
    const { data, error } = await supabase.storage
      .from('product-assets')
      .download(storagePath);

    if (error) {
      showError("Erro ao baixar arquivo: " + error.message);
      console.error("Error downloading file:", error);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'client-asset-download',
        message: `Failed to download product asset: ${error.message}`,
        metadata: { userId: user?.id, productId, fileName, storagePath, error: error.message }
      });
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
    showSuccess(`Download de "${fileName}" iniciado!`);
    await supabase.from('logs').insert({
      level: 'info',
      context: 'client-asset-download',
      message: 'Client downloaded product asset successfully.',
      metadata: { userId: user?.id, productId, fileName, storagePath }
    });
  };

  const handleViewPdf = async (storagePath: string, fileName: string) => {
    // Usar createSignedUrl para gerar um link temporário para visualização
    const { data, error } = await supabase.storage
      .from('product-assets')
      .createSignedUrl(storagePath, 3600); // URL válida por 1 hora

    if (error) {
      showError("Erro ao gerar link de visualização do PDF: " + error.message);
      console.error("Error creating signed URL for PDF view:", error);
      await supabase.from('logs').insert({
        level: 'error',
        context: 'client-asset-view',
        message: `Failed to generate signed URL for PDF view: ${error.message}`,
        metadata: { userId: user?.id, productId, fileName, storagePath, error: error.message }
      });
      return;
    }

    if (data?.signedUrl) {
      setCurrentPdfUrl(data.signedUrl);
      setCurrentPdfName(fileName);
      setIsPdfViewerOpen(true);
      await supabase.from('logs').insert({
        level: 'info',
        context: 'client-asset-view',
        message: 'Client viewed product asset successfully.',
        metadata: { userId: user?.id, productId, fileName, storagePath }
      });
    } else {
      showError("Não foi possível obter o link de visualização do PDF.");
      await supabase.from('logs').insert({
        level: 'error',
        context: 'client-asset-view',
        message: 'Signed URL for PDF view was null or undefined.',
        metadata: { userId: user?.id, productId, fileName, storagePath }
      });
    }
  };

  const handleClosePdfViewer = () => {
    setIsPdfViewerOpen(false);
    // Não é necessário revogar Object URL, pois estamos usando signed URL diretamente
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
          {product.assets && product.assets.length > 0 ? (
            <div className="space-y-4">
              {product.assets.map((asset) => (
                <div
                  key={asset.id}
                  className="flex flex-col sm:flex-row items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3 mb-2 sm:mb-0">
                    <FileText className="h-6 w-6 text-blue-500" />
                    <span className="text-gray-700 font-medium">{asset.file_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="text-blue-500 hover:text-blue-700"
                      onClick={() => handleViewPdf(asset.storage_path, asset.file_name)}
                    >
                      <Eye className="h-4 w-4 mr-2" /> Visualizar
                    </Button>
                    <Button
                      className="bg-orange-500 hover:bg-orange-600 text-white"
                      onClick={() => handleDownloadAsset(asset.storage_path, asset.file_name)}
                    >
                      Baixar
                    </Button>
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
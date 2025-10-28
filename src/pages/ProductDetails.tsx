"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, ProductAsset } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, FileText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ProductDetails = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<(Product & { assets?: ProductAsset[] }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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
                  className="flex items-center justify-between p-4 border rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-6 w-6 text-blue-500" /> {/* Ícone de PDF azul */}
                    <span className="text-gray-700 font-medium">{asset.file_name}</span>
                  </div>
                  <Button
                    className="bg-orange-500 hover:bg-orange-600 text-white"
                    onClick={() => handleDownloadAsset(asset.storage_path, asset.file_name)}
                  >
                    Baixar
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">Nenhum arquivo disponível para este produto.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductDetails;
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Package, Info } from "lucide-react";
import { UseFormReturn } from "react-hook-form";

interface ProductKitTabProps {
    form: UseFormReturn<any>;
    isLoading: boolean;
    currentProductId?: string;
}

const ProductKitTab = ({ form, isLoading, currentProductId }: ProductKitTabProps) => {
    const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
    const [isLoadingProducts, setIsLoadingProducts] = useState(true);

    const isKit = form.watch("is_kit") || false;
    const selectedProductIds = form.watch("kit_product_ids") || [];

    useEffect(() => {
        const fetchProducts = async () => {
            setIsLoadingProducts(true);
            // Buscar todos os produtos (sem filtrar is_kit pois a coluna pode não existir ainda)
            const { data, error } = await supabase
                .from("products")
                .select("id, name, price, status")
                .order("name");

            if (error) {
                console.error("Error fetching products for kit:", error);
                setAvailableProducts([]);
            } else {
                // Filtrar o produto atual
                // Nota: quando a migration for aplicada, adicionar filtro para !is_kit
                const filtered = (data || []).filter(
                    (p: any) => p.id !== currentProductId
                );
                setAvailableProducts(filtered as Product[]);
            }
            setIsLoadingProducts(false);
        };

        fetchProducts();
    }, [currentProductId]);

    const handleKitToggle = (checked: boolean) => {
        form.setValue("is_kit", checked);
        if (!checked) {
            form.setValue("kit_product_ids", []);
            form.setValue("kit_original_value", null);
        }
    };

    const handleProductToggle = (productId: string, checked: boolean) => {
        const current = selectedProductIds || [];
        let newIds: string[];
        if (checked) {
            newIds = [...current, productId];
        } else {
            newIds = current.filter((id: string) => id !== productId);
        }
        form.setValue("kit_product_ids", newIds);

        // Atualizar o valor original automaticamente
        const totalValue = availableProducts
            .filter((p) => newIds.includes(p.id))
            .reduce((sum, p) => sum + (p.price || 0), 0);
        form.setValue("kit_original_value", totalValue > 0 ? totalValue : null);
    };

    const calculateTotalValue = () => {
        return availableProducts
            .filter((p) => selectedProductIds.includes(p.id))
            .reduce((sum, p) => sum + (p.price || 0), 0);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    return (
        <div className="space-y-6">
            {/* Toggle para Kit */}
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Configuração de Kit
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-3">
                        <Checkbox
                            id="is_kit"
                            checked={isKit}
                            onCheckedChange={handleKitToggle}
                            disabled={isLoading}
                        />
                        <Label htmlFor="is_kit" className="text-sm font-medium cursor-pointer">
                            Este produto é um <strong>Kit (Bundle)</strong>
                        </Label>
                    </div>

                    {isKit && (
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-start gap-2">
                                <Info className="h-4 w-4 text-blue-600 mt-0.5" />
                                <p className="text-sm text-blue-800">
                                    Um kit é um produto composto por outros produtos. Quando o cliente compra o kit,
                                    ele recebe acesso a <strong>todos os produtos selecionados abaixo</strong>,
                                    podendo fazer download dos PDFs normalmente.
                                </p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Seleção de Produtos */}
            {isKit && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">Produtos do Kit</CardTitle>
                            {selectedProductIds.length > 0 && (
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline">
                                        {selectedProductIds.length} produto(s) selecionado(s)
                                    </Badge>
                                    <Badge className="bg-green-100 text-green-800 border-green-200">
                                        Valor total: {formatCurrency(calculateTotalValue())}
                                    </Badge>
                                </div>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent>
                        {isLoadingProducts ? (
                            <div className="flex items-center justify-center p-8">
                                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                            </div>
                        ) : availableProducts.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <Package className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                                <p>Nenhum produto disponível para adicionar ao kit.</p>
                                <p className="text-xs mt-1">Crie produtos individuais primeiro.</p>
                            </div>
                        ) : (
                            <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                {availableProducts.map((product) => {
                                    const isSelected = selectedProductIds.includes(product.id);
                                    return (
                                        <div
                                            key={product.id}
                                            className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${isSelected
                                                ? "bg-orange-50 border-orange-200"
                                                : "bg-gray-50 border-gray-200 hover:bg-gray-100"
                                                }`}
                                        >
                                            <div className="flex items-center space-x-3">
                                                <Checkbox
                                                    id={`kit-product-${product.id}`}
                                                    checked={isSelected}
                                                    onCheckedChange={(checked) => handleProductToggle(product.id, !!checked)}
                                                    disabled={isLoading}
                                                />
                                                <div>
                                                    <Label
                                                        htmlFor={`kit-product-${product.id}`}
                                                        className="text-sm font-medium cursor-pointer"
                                                    >
                                                        {product.name}
                                                    </Label>
                                                    <p className="text-xs text-gray-500">ID: {product.id.substring(0, 8)}...</p>
                                                </div>
                                            </div>
                                            <Badge variant="outline" className="font-mono">
                                                {formatCurrency(product.price || 0)}
                                            </Badge>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Resumo do Kit */}
                        {selectedProductIds.length > 0 && (
                            <div className="mt-4 p-4 bg-orange-50 rounded-lg border border-orange-200">
                                <h4 className="font-semibold text-orange-800 mb-2">Resumo do Kit</h4>
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                        <span className="text-gray-600">Produtos incluídos:</span>
                                        <span className="font-medium ml-2">{selectedProductIds.length}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Valor individual total:</span>
                                        <span className="font-medium ml-2">{formatCurrency(calculateTotalValue())}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Preço do kit:</span>
                                        <span className="font-medium ml-2 text-orange-600">
                                            {formatCurrency(form.watch("price") || 0)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="text-gray-600">Economia para cliente:</span>
                                        <span className="font-medium ml-2 text-green-600">
                                            {formatCurrency(Math.max(0, calculateTotalValue() - (form.watch("price") || 0)))}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default ProductKitTab;

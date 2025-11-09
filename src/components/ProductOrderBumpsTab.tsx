"use client";

import React, { useState, useEffect, useCallback } from "react";
import { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X, Plus, Search } from "lucide-react";
import { Product } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  price: z.coerce.number().min(0.01, "O preço deve ser maior que zero"),
  description: z.string().optional(),
  memberareaurl: z.string().url("URL inválida").optional().or(z.literal("")),
  orderbumps: z.array(z.string()).optional(), // Array of product IDs
});

interface ProductOrderBumpsTabProps {
  form: UseFormReturn<z.infer<typeof formSchema>>;
  isLoading: boolean;
  currentProductId?: string; // The ID of product being edited
}

const ProductOrderBumpsTab = ({ form, isLoading, currentProductId }: ProductOrderBumpsTabProps) => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [activeBumpsDetails, setActiveBumpsDetails] = useState<Product[]>([]);

  const selectedOrderBumps = form.watch("orderbumps") || [];

  const fetchAllProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name, price");

    if (error) {
      showError("Erro ao carregar produtos: " + error.message);
      console.error("Error fetching all products:", error);
    } else {
      setAllProducts(data || []);
    }
  }, []);

  const updateActiveBumpsDetails = useCallback(() => {
    const details = selectedOrderBumps
      .map((bumpId) => allProducts.find((p) => p.id === bumpId))
      .filter((p): p is Product => p !== undefined);
    setActiveBumpsDetails(details);
  }, [selectedOrderBumps, allProducts]);

  useEffect(() => {
    fetchAllProducts();
  }, [fetchAllProducts]);

  useEffect(() => {
    updateActiveBumpsDetails();
  }, [selectedOrderBumps, allProducts, updateActiveBumpsDetails]);

  const handleAddOrderBump = (bumpId: string) => {
    const currentOrderBumps = form.getValues("orderbumps") || [];
    if (!currentOrderBumps.includes(bumpId)) {
      form.setValue("orderbumps", [...currentOrderBumps, bumpId], { shouldDirty: true });
    }
  };

  const handleRemoveOrderBump = (bumpId: string) => {
    const currentOrderBumps = form.getValues("orderbumps") || [];
    form.setValue(
      "orderbumps",
      currentOrderBumps.filter((id) => id !== bumpId),
      { shouldDirty: true }
    );
  };

  const availableProducts = allProducts.filter(
    (p) =>
      p.id !== currentProductId &&
      !selectedOrderBumps.includes(p.id) &&
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Coluna 1: Bumps Ativos */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Bumps Ativos</h3>
        <div className="border rounded-md p-3 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
          {activeBumpsDetails.length > 0 ? (
            <div className="space-y-2">
              {activeBumpsDetails.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm"
                >
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-gray-600 ml-2">R$ {product.price.toFixed(2)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveOrderBump(product.id)}
                    disabled={isLoading}
                    className="text-red-500 hover:bg-red-100"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum order bump associado.</p>
          )}
        </div>
      </div>

      {/* Coluna 2: Adicionar Novo Bump */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Adicionar Produto como Bump</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder="Buscar produto..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            disabled={isLoading}
          />
        </div>
        <div className="border rounded-md p-3 min-h-[200px] max-h-[400px] overflow-y-auto bg-gray-50">
          {availableProducts.length > 0 ? (
            <div className="space-y-2">
              {availableProducts.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between p-2 border rounded-md bg-white shadow-sm"
                >
                  <div>
                    <span className="font-medium">{product.name}</span>
                    <span className="text-sm text-gray-600 ml-2">R$ {product.price.toFixed(2)}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleAddOrderBump(product.id)}
                    disabled={isLoading}
                    className="text-blue-500 hover:bg-blue-100"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">Nenhum produto disponível para adicionar.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductOrderBumpsTab;
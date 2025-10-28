"use client";

import React, { useState, useEffect } from "react";
import { UseFormReturn } from "react-hook-form";
import * as z from "zod";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
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
  currentProductId?: string; // The ID of the product being edited
}

const ProductOrderBumpsTab = ({ form, isLoading, currentProductId }: ProductOrderBumpsTabProps) => {
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [selectedBumpId, setSelectedBumpId] = useState<string>("");

  useEffect(() => {
    const fetchAvailableProducts = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name");

      if (error) {
        showError("Erro ao carregar produtos disponíveis para order bumps: " + error.message);
        console.error("Error fetching available products:", error);
      } else {
        // Filter out the current product itself and already selected order bumps
        const currentOrderBumps = form.getValues("orderbumps") || [];
        const filteredProducts = (data || []).filter(
          (p) => p.id !== currentProductId && !currentOrderBumps.includes(p.id)
        );
        setAvailableProducts(filteredProducts);
      }
    };
    fetchAvailableProducts();
  }, [currentProductId, form.watch("orderbumps")]); // Re-fetch when orderbumps change

  const handleAddOrderBump = () => {
    if (selectedBumpId) {
      const currentOrderBumps = form.getValues("orderbumps") || [];
      if (!currentOrderBumps.includes(selectedBumpId)) {
        form.setValue("orderbumps", [...currentOrderBumps, selectedBumpId], { shouldDirty: true });
        setSelectedBumpId(""); // Clear selection
      }
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

  const selectedOrderBumps = form.watch("orderbumps") || [];

  return (
    <div className="space-y-4">
      <FormField
        control={form.control}
        name="orderbumps"
        render={() => (
          <FormItem>
            <FormLabel>Order Bumps</FormLabel>
            <div className="flex gap-2">
              <Select onValueChange={setSelectedBumpId} value={selectedBumpId} disabled={isLoading}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um produto para Order Bump" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {availableProducts.map((product) => (
                    <SelectItem key={product.id} value={product.id}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={handleAddOrderBump} disabled={isLoading || !selectedBumpId}>
                <Plus className="h-4 w-4 mr-2" /> Adicionar
              </Button>
            </div>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="space-y-2">
        {selectedOrderBumps.length > 0 ? (
          selectedOrderBumps.map((bumpId) => {
            const bumpProduct = availableProducts.find((p) => p.id === bumpId) ||
                                form.getValues("orderbumps")?.includes(bumpId) && initialData?.orderbumps?.includes(bumpId)
                                  ? { id: bumpId, name: `Produto ID: ${bumpId}` } as Product // Fallback for initial data not in availableProducts
                                  : undefined;

            if (!bumpProduct) return null; // Should not happen if logic is correct

            return (
              <div key={bumpId} className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
                <span>{bumpProduct.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveOrderBump(bumpId)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-gray-500">Nenhum order bump adicionado.</p>
        )}
      </div>
    </div>
  );
};

export default ProductOrderBumpsTab;
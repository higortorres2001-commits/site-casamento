"use client";

import React, { memo } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";
import { cn } from "@/lib/utils";

interface OrderBumpCardProps {
  product: Product;
  isSelected: boolean;
  onToggle: (productId: string, isSelected: boolean) => void;
}

const OrderBumpCard = memo(({ product, isSelected, onToggle }: OrderBumpCardProps) => {
  return (
    <Card
      className={cn(
        "bg-white rounded-xl shadow-lg p-4 flex items-center space-x-3 cursor-pointer transition-all duration-200",
        isSelected ? "border-2 border-orange-500" : "border-2 border-gray-300 hover:border-gray-400"
      )}
      onClick={() => onToggle(product.id, !isSelected)}
    >
      <Checkbox
        id={`order-bump-${product.id}`}
        checked={isSelected}
        onCheckedChange={(checked) => onToggle(product.id, checked as boolean)}
        className="h-6 w-6 border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
      />
      <label
        htmlFor={`order-bump-${product.id}`}
        className="flex-1 text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
      >
        <div className="flex justify-between items-center">
          <span className="text-base text-gray-800">Adicionar {product.name} por apenas</span>
          <span className="font-normal text-gray-700 text-sm">R$ {product.price.toFixed(2)}</span>
        </div>
        {product.description && (
          <p className="text-sm text-gray-500 mt-1">{product.description}</p>
        )}
      </label>
    </Card>
  );
}, (prevProps, nextProps) => {
  // ✅ OTIMIZAÇÃO: Re-render apenas se isSelected mudar
  return prevProps.isSelected === nextProps.isSelected && 
         prevProps.product.id === nextProps.product.id;
});

OrderBumpCard.displayName = "OrderBumpCard";

export default OrderBumpCard;
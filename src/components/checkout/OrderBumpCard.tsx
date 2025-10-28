"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";

interface OrderBumpCardProps {
  product: Product;
  isSelected: boolean;
  onToggle: (productId: string, isSelected: boolean) => void;
}

const OrderBumpCard = ({ product, isSelected, onToggle }: OrderBumpCardProps) => {
  return (
    <Card className="bg-white rounded-xl shadow-lg p-4 flex items-center space-x-3">
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
          <span>Adicionar {product.name} por apenas</span>
          <span className="font-semibold text-gray-900">R$ {product.price.toFixed(2)}</span>
        </div>
        {product.description && (
          <p className="text-sm text-gray-500 mt-1">{product.description}</p>
        )}
      </label>
    </Card>
  );
};

export default OrderBumpCard;
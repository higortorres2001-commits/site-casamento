"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";
import { cn } from "@/lib/utils"; // Import cn for conditional class names

interface OrderBumpCardProps {
  product: Product;
  isSelected: boolean;
  onToggle: (productId: string, isSelected: boolean) => void;
}

const OrderBumpCard = ({ product, isSelected, onToggle }: OrderBumpCardProps) => {
  return (
    <Card
      className={cn(
        "bg-white rounded-xl shadow-lg p-4 flex items-center space-x-3 cursor-pointer transition-all duration-200",
        isSelected ? "border-2 border-orange-500" : "border-2 border-gray-300 hover:border-gray-400"
      )}
      onClick={() => onToggle(product.id, !isSelected)}
    >
      {/* Optional: Image of the bump */}
      {/* <img src={product.imageUrl} alt={product.name} className="w-16 h-16 object-cover rounded-md" /> */}
      <Checkbox
        id={`order-bump-${product.id}`}
        checked={isSelected}
        // Prevent event bubbling from checkbox click to card click
        onCheckedChange={(checked) => onToggle(product.id, checked as boolean)}
        className="h-6 w-6 border-orange-500 data-[state=checked]:bg-orange-500 data-[state=checked]:text-white"
      />
      <label
        htmlFor={`order-bump-${product.id}`}
        className="flex-1 text-base font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
      >
        <div className="flex justify-between items-center">
          <span className="text-base text-gray-800">Adicionar {product.name} por apenas</span> {/* Adjusted font size */}
          <span className="font-normal text-gray-700 text-sm">R$ {product.price.toFixed(2)}</span> {/* Adjusted font size */}
        </div>
        {product.description && (
          <p className="text-sm text-gray-500 mt-1">{product.description}</p>
        )}
      </label>
    </Card>
  );
};

export default OrderBumpCard;
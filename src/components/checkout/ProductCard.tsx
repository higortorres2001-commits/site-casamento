"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Card className="bg-white rounded-xl shadow-lg border-2 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold text-blue-800">{product.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {product.image_url && (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-48 object-cover rounded-md mb-2"
          />
        )}
        {product.description && (
          <p className="text-gray-700 text-base">{product.description}</p>
        )}
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-lg font-bold text-gray-900">Preço:</span>
          <span className="font-normal text-gray-700 text-lg">R$ {product.price.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
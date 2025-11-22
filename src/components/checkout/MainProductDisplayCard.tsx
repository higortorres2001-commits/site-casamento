"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product } from "@/types";
import { Skeleton } from "@/components/ui/skeleton";

interface MainProductDisplayCardProps {
  product: Product;
}

const MainProductDisplayCard = ({ product }: MainProductDisplayCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <Card className="bg-white rounded-xl shadow-lg border-2 border-blue-200">
      <CardHeader className="pb-2">
        <CardTitle className="text-2xl font-bold text-blue-800">{product.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {product.image_url && (
          <div className="relative w-full h-48 bg-gray-100 rounded-md overflow-hidden">
            {!imageLoaded && !imageError && (
              <Skeleton className="w-full h-full" />
            )}
            <img
              src={product.image_url}
              alt={product.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                imageLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(true);
              }}
            />
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                <span className="text-gray-500 text-sm">Imagem não disponível</span>
              </div>
            )}
          </div>
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

export default MainProductDisplayCard;
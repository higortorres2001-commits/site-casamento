"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <div className="space-y-6">
      {/* Produto Principal */}
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

      {/* Banner Promocional */}
      <Card className="bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 border-orange-200 shadow-lg">
        <CardContent className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-orange-800">
                Oferta Especial por Tempo Limitado!
              </h3>
              <p className="text-orange-700">
                Adquira agora e tenha acesso imediato aos materiais exclusivos!
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
              ✅ Entrega Imediata
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
              📚 Materiais Exclusivos
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1">
              🎓 Suporte Premium
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductCard;
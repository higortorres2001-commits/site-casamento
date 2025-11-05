"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types";

interface ProductsAlsoBuyProps {
  products: Product[];
}

const ProductsAlsoBuy = ({ products }: ProductsAlsoBuyProps) => {
  if (!products || products.length === 0) {
    return null;
  }

  return (
    <div className="mt-12 space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-800 mb-2">Compre Também</h2>
        <p className="text-gray-600">Aproveite nossos outros produtos e amplie seu conhecimento!</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <Card key={product.id} className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
            {product.image_url && (
              <div className="relative w-full h-48 overflow-hidden">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-semibold text-gray-800 line-clamp-2">
                {product.name}
              </CardTitle>
            </CardHeader>
            
            <CardContent className="space-y-4">
              {product.description && (
                <p className="text-gray-600 text-sm line-clamp-3">
                  {product.description}
                </p>
              )}
              
              {/* Badge de preço melhorado */}
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-gray-500">R$</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {product.price.toFixed(2).replace('.', ',')}
                  </span>
                </div>
              </div>
              
              <Link to={`/checkout/${product.id}`}>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 text-base transition-all duration-200 hover:shadow-lg">
                  Comprar Agora
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProductsAlsoBuy;
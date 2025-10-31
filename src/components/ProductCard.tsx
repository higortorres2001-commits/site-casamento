"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Product } from "@/types";
import { Link } from "react-router-dom";

interface ProductCardProps {
  product: Product;
}

const ProductCard = ({ product }: ProductCardProps) => {
  return (
    <Card className="bg-white rounded-xl shadow-lg flex flex-col overflow-hidden">
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
      <CardContent className="flex-grow flex flex-col justify-between p-4 pt-0">
        {product.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {product.description}
          </p>
        )}
        {product.internal_tag && (
          <span className="inline-block text-xs px-2 py-1 rounded bg-slate-100 text-slate-700 mb-2">
            {product.internal_tag}
          </span>
        )}
        <div className="mt-auto">
          {product.memberareaurl ? (
            <a href={product.memberareaurl} target="_blank" rel="noopener noreferrer">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Acessar Conteúdo
              </Button>
            </a>
          ) : (
            <Link to={`/produto/${product.id}`}>
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Acessar Conteúdo
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
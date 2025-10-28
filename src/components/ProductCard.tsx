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
    <Card className="bg-white rounded-xl shadow-lg flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-gray-800">
          {product.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-grow flex flex-col justify-between">
        {product.description && (
          <p className="text-sm text-gray-600 mb-4 line-clamp-3">
            {product.description}
          </p>
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
"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types";
import { Package } from "lucide-react";

interface OrderSummaryCardProps {
  product: Product;
}

const OrderSummaryCard = ({ product }: OrderSummaryCardProps) => {
  // Validações defensivas - funciona mesmo sem os campos do banco
  const isKit = Boolean((product as any)?.is_kit);
  const kitOriginalValue = Number((product as any)?.kit_original_value) || 0;
  const productPrice = Number(product?.price) || 0;

  // Só mostra economia se é kit E tem valor original maior que o preço atual
  const hasDiscount = isKit && kitOriginalValue > 0 && kitOriginalValue > productPrice;

  return (
    <Card className="bg-white rounded-xl shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl">Resumo do Pedido</CardTitle>
          {isKit && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1">
              <Package className="h-3 w-3" />
              Kit
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700">{product.name}</span>
          <div className="text-right">
            {hasDiscount ? (
              <div className="flex flex-col items-end">
                <span className="text-sm text-gray-500 line-through">
                  de R$ {kitOriginalValue.toFixed(2)}
                </span>
                <span className="font-bold text-lg text-green-600">
                  por R$ {product.price.toFixed(2)}
                </span>
                <Badge className="bg-green-100 text-green-800 border-green-200 text-xs mt-1">
                  Economia de R$ {(kitOriginalValue - product.price).toFixed(2)}
                </Badge>
              </div>
            ) : (
              <span className="font-semibold text-gray-900">R$ {product.price.toFixed(2)}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSummaryCard;
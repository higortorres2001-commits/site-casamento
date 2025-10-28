"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Product } from "@/types";

interface OrderSummaryCardProps {
  product: Product;
}

const OrderSummaryCard = ({ product }: OrderSummaryCardProps) => {
  return (
    <Card className="bg-white rounded-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Resumo do Pedido</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex justify-between items-center mb-2">
          <span className="text-gray-700">{product.name}</span>
          <span className="font-semibold text-gray-900">R$ {product.price.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrderSummaryCard;
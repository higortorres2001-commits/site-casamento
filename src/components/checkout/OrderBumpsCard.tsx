"use client";

import React from "react";
import { Product } from "@/types";
import OrderBumpCard from "./OrderBumpCard";

interface OrderBumpsCardProps {
  orderBumps: Product[];
  selectedOrderBumps: string[];
  onOrderBumpToggle: (bumpId: string, isSelected: boolean) => void;
}

const OrderBumpsCard = ({ orderBumps, selectedOrderBumps, onOrderBumpToggle }: OrderBumpsCardProps) => {
  if (orderBumps.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">
          Aproveite também estas ofertas especiais!
        </h2>
        <p className="text-gray-600">
          Produtos complementares selecionados especialmente para você
        </p>
      </div>
      <div className="space-y-4">
        {orderBumps.map((bump) => (
          <OrderBumpCard
            key={bump.id}
            product={bump}
            isSelected={selectedOrderBumps.includes(bump.id)}
            onToggle={onOrderBumpToggle}
          />
        ))}
      </div>
    </div>
  );
};

export default OrderBumpsCard;
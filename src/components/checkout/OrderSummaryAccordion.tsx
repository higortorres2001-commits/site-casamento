"use client";

import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Product, Coupon } from "@/types";
import { ChevronDown, Package } from 'lucide-react';
import CouponInputCard from "./CouponInputCard";

interface OrderSummaryAccordionProps {
  mainProduct: Product;
  selectedOrderBumpsDetails: Product[];
  originalTotalPrice: number;
  currentTotalPrice: number;
  appliedCoupon: Coupon | null;
  onCouponApplied: (coupon: Coupon | null) => void;
}

const OrderSummaryAccordion = ({
  mainProduct,
  selectedOrderBumpsDetails,
  originalTotalPrice,
  currentTotalPrice,
  appliedCoupon,
  onCouponApplied,
}: OrderSummaryAccordionProps) => {
  const discountAmount = originalTotalPrice - currentTotalPrice;

  // Kit info com validações defensivas - funciona mesmo sem os campos do banco
  const isKit = Boolean((mainProduct as any)?.is_kit);
  const kitOriginalValue = Number((mainProduct as any)?.kit_original_value) || 0;
  const productPrice = Number(mainProduct?.price) || 0;
  const hasKitSavings = isKit && kitOriginalValue > 0 && kitOriginalValue > productPrice;

  console.log("🎯 OrderSummary - Cupom aplicado:", appliedCoupon);
  console.log("🎯 OrderSummary - Desconto calculado:", discountAmount);

  return (
    <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
      <AccordionItem value="item-1" className="border-none">
        <div className="bg-blue-100 rounded-xl shadow-md">
          <AccordionTrigger className="flex justify-between items-center p-4 text-xl font-bold text-gray-800 hover:no-underline">
            <div className="flex items-center gap-2">
              <span>Resumo do Pedido</span>
              {isKit && (
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 flex items-center gap-1">
                  <Package className="h-3 w-3" />
                  Kit
                </Badge>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t border-blue-200 bg-white rounded-b-xl">
            <div className="space-y-3">
              <div className="flex justify-between items-start text-gray-700 text-base">
                <span>{mainProduct.name}</span>
                <div className="text-right">
                  {hasKitSavings ? (
                    <div className="flex flex-col items-end">
                      <span className="text-xs text-gray-400 line-through">
                        de R$ {kitOriginalValue.toFixed(2)}
                      </span>
                      <span className="font-semibold text-green-600">
                        por R$ {mainProduct.price.toFixed(2)}
                      </span>
                    </div>
                  ) : (
                    <span className="font-normal text-gray-600 text-sm">R$ {mainProduct.price.toFixed(2)}</span>
                  )}
                </div>
              </div>
              {selectedOrderBumpsDetails.map((bump) => (
                <div key={bump.id} className="flex justify-between items-center text-gray-600 text-sm">
                  <span>+ {bump.name}</span>
                  <span className="font-normal text-gray-600 text-sm">R$ {bump.price.toFixed(2)}</span>
                </div>
              ))}
              {appliedCoupon && discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600 font-semibold text-base pt-2 border-t border-gray-200">
                  <span>Desconto ({appliedCoupon.code})</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 text-lg font-bold text-gray-900">
                <span>Total Final:</span>
                <span>R$ {currentTotalPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Cupom de Desconto - Integrado dentro do resumo */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <CouponInputCard
                onCouponApplied={onCouponApplied} // ✅ PASSANDO A FUNÇÃO
                appliedCoupon={appliedCoupon}
              />
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
};

export default OrderSummaryAccordion;
"use client";

import React, { useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Product, Coupon } from "@/types";
import { ChevronDown } from 'lucide-react';
import CouponInputCard from "./CouponInputCard";

interface OrderSummaryAccordionProps {
  mainProduct: Product;
  selectedOrderBumpsDetails: Product[];
  originalTotalPrice: number;
  currentTotalPrice: number;
  appliedCoupon: Coupon | null;
}

const OrderSummaryAccordion = ({
  mainProduct,
  selectedOrderBumpsDetails,
  originalTotalPrice,
  currentTotalPrice,
  appliedCoupon,
}: OrderSummaryAccordionProps) => {
  const discountAmount = originalTotalPrice - currentTotalPrice;

  return (
    <Accordion type="single" collapsible defaultValue="item-1" className="w-full">
      <AccordionItem value="item-1" className="border-none">
        <div className="bg-blue-100 rounded-xl shadow-md">
          <AccordionTrigger className="flex justify-between items-center p-4 text-xl font-bold text-gray-800 hover:no-underline">
            <span>Resumo do Pedido</span>
            {/* Removido o preço e o ícone ChevronDown daqui, o ícone padrão do AccordionTrigger será mantido */}
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t border-blue-200 bg-white rounded-b-xl">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-gray-700 text-base">
                <span>{mainProduct.name}</span>
                <span className="font-normal text-gray-600 text-sm">R$ {mainProduct.price.toFixed(2)}</span>
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
                onCouponApplied={() => {}} 
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
"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Product, Coupon } from "@/types"; // Import Coupon type
import { ChevronDown } from 'lucide-react';

interface OrderSummaryAccordionProps {
  mainProduct: Product;
  selectedOrderBumpsDetails: Product[];
  originalTotalPrice: number; // New prop
  currentTotalPrice: number;
  appliedCoupon: Coupon | null; // New prop
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
        <div className="bg-blue-100 rounded-xl shadow-md"> {/* Changed to rounded-xl for consistency */}
          <AccordionTrigger className="flex justify-between items-center p-4 text-xl font-bold text-gray-800 hover:no-underline"> {/* Increased font size */}
            <span>Resumo do Pedido</span> {/* Simplified title */}
            <span className="flex items-center text-2xl font-extrabold text-orange-500"> {/* Prominent total */}
              R$ {currentTotalPrice.toFixed(2)}
              <ChevronDown className="h-6 w-6 ml-2 shrink-0 transition-transform duration-200" /> {/* Increased icon size */}
            </span>
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t border-blue-200 bg-white rounded-b-xl"> {/* Changed to rounded-b-xl */}
            <div className="space-y-3">
              <div className="flex justify-between items-center text-gray-700 text-base"> {/* Base product */}
                <span>{mainProduct.name}</span>
                <span className="font-semibold">R$ {mainProduct.price.toFixed(2)}</span>
              </div>
              {selectedOrderBumpsDetails.map((bump) => (
                <div key={bump.id} className="flex justify-between items-center text-gray-600 text-sm"> {/* Order bumps */}
                  <span>+ {bump.name}</span>
                  <span className="font-medium">R$ {bump.price.toFixed(2)}</span>
                </div>
              ))}
              {appliedCoupon && discountAmount > 0 && (
                <div className="flex justify-between items-center text-green-600 font-semibold text-base pt-2 border-t border-gray-200"> {/* Discount in green */}
                  <span>Desconto ({appliedCoupon.code})</span>
                  <span>- R$ {discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center pt-3 border-t border-gray-300 text-lg font-bold text-gray-900"> {/* Final total */}
                <span>Total Final:</span>
                <span>R$ {currentTotalPrice.toFixed(2)}</span>
              </div>
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
};

export default OrderSummaryAccordion;
"use client";

import React from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Product } from "@/types";
import { ChevronDown } from 'lucide-react';

interface OrderSummaryAccordionProps {
  mainProduct: Product;
  selectedOrderBumpsDetails: Product[];
  currentTotalPrice: number;
}

const OrderSummaryAccordion = ({
  mainProduct,
  selectedOrderBumpsDetails,
  currentTotalPrice,
}: OrderSummaryAccordionProps) => {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="item-1" className="border-none">
        <div className="bg-blue-100 rounded-lg shadow-md">
          <AccordionTrigger className="flex justify-between items-center p-4 text-lg font-semibold text-gray-800 hover:no-underline">
            <span>Ver Resumo do Pedido</span>
            <span className="flex items-center">
              Total: R$ {currentTotalPrice.toFixed(2)}
              <ChevronDown className="h-5 w-5 ml-2 shrink-0 transition-transform duration-200" />
            </span>
          </AccordionTrigger>
          <AccordionContent className="p-4 border-t border-blue-200 bg-white rounded-b-lg">
            <div className="space-y-3">
              <div className="flex justify-between items-center text-gray-700">
                <span>{mainProduct.name}</span>
                <span className="font-semibold">R$ {mainProduct.price.toFixed(2)}</span>
              </div>
              {selectedOrderBumpsDetails.map((bump) => (
                <div key={bump.id} className="flex justify-between items-center text-gray-600 text-sm">
                  <span>+ {bump.name}</span>
                  <span className="font-medium">R$ {bump.price.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </AccordionContent>
        </div>
      </AccordionItem>
    </Accordion>
  );
};

export default OrderSummaryAccordion;
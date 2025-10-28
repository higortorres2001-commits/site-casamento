"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface FixedBottomBarProps {
  totalPrice: number;
  isSubmitting: boolean;
  onSubmit: () => void;
}

const FixedBottomBar = ({ totalPrice, isSubmitting, onSubmit }: FixedBottomBarProps) => {
  return (
    <div className="fixed bottom-0 left-0 w-full bg-white shadow-top p-4 border-t border-gray-200 z-50">
      <div className="max-w-md mx-auto flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-xl font-bold text-gray-900">Total:</span> {/* Increased font size */}
          <span className="text-2xl text-gray-500">R$ {totalPrice.toFixed(2)}</span> {/* Ajustado: cinza claro, sem negrito, menor */}
        </div>
        <Button
          type="submit"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
          disabled={isSubmitting}
          onClick={onSubmit}
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar Compra Agora"}
        </Button>
      </div>
    </div>
  );
};

export default FixedBottomBar;
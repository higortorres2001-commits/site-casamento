"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface FixedBottomBarProps {
  totalPrice: number;
  isSubmitting: boolean;
  onSubmit: () => void;
  buttonText?: string;
}

const FixedBottomBar = ({ totalPrice, isSubmitting, onSubmit, buttonText = "Finalizar Compra" }: FixedBottomBarProps) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-[9999] safe-area-inset-bottom">
      {/* Gradiente sutil para indicar que há conteúdo acima */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-b from-gray-100/50 to-transparent pointer-events-none"></div>

      <div className="container mx-auto max-w-2xl px-4 py-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Total Price */}
          <div className="flex justify-between items-center sm:flex-col sm:items-start">
            <span className="text-lg font-bold text-gray-900">Total:</span>
            <span className="text-2xl font-semibold text-orange-600">R$ {totalPrice.toFixed(2)}</span>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full sm:w-auto sm:min-w-[200px] bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-lg py-3 px-6 text-lg font-semibold transition-all duration-200 hover:shadow-xl disabled:opacity-50"
            disabled={isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Processando...</span>
              </div>
            ) : (
              buttonText
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FixedBottomBar;
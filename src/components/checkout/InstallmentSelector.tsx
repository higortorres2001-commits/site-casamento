"use client";

import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { InstallmentOption } from '@/hooks/use-installments';

interface InstallmentSelectorProps {
  installments: InstallmentOption[];
  isLoading: boolean;
  error: string | null;
  selectedInstallment: number;
  onSelectInstallment: (installmentNumber: number) => void;
  disabled?: boolean;
}

const InstallmentSelector = ({
  installments,
  isLoading,
  error,
  selectedInstallment,
  onSelectInstallment,
  disabled = false,
}: InstallmentSelectorProps) => {
  if (error) {
    return (
      <div className="space-y-2">
        <Label>Parcelas</Label>
        <div className="text-sm text-red-600 p-3 bg-red-50 rounded-md border border-red-200">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="installments">Número de Parcelas</Label>
      <Select
        value={selectedInstallment.toString()}
        onValueChange={(value) => onSelectInstallment(parseInt(value))}
        disabled={disabled || isLoading}
      >
        <SelectTrigger id="installments" className="w-full">
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Calculando parcelas...</span>
            </div>
          ) : (
            <SelectValue placeholder="Selecione o número de parcelas" />
          )}
        </SelectTrigger>
        <SelectContent>
          {installments.map((option) => (
            <SelectItem key={option.installmentNumber} value={option.installmentNumber.toString()}>
              {option.installmentNumber}x de R$ {option.installmentValue.toFixed(2)}
              {option.interestPercentage > 0 && (
                <span className="text-xs text-gray-500 ml-2">
                  (Total: R$ {option.totalValue.toFixed(2)})
                </span>
              )}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default InstallmentSelector;
"use client";

import { useState, useEffect } from 'react';
import { useDebounce } from 'use-debounce';
import { supabase } from '@/integrations/supabase/client';

export interface InstallmentOption {
  installmentNumber: number;
  installmentValue: number;
  totalValue: number;
  interestPercentage: number;
}

interface UseInstallmentsProps {
  totalPrice: number;
  enabled: boolean;
}

// Função local de fallback para calcular parcelas
function calculateInstallmentsLocally(totalPrice: number): InstallmentOption[] {
  const installments: InstallmentOption[] = [];
  const MAX_INSTALLMENTS = 6;
  const MIN_INSTALLMENT_VALUE = 6.00;
  
  const interestRates: Record<number, number> = {
    1: 0,
    2: 2.99,
    3: 3.99,
    4: 4.99,
    5: 5.99,
    6: 6.99,
    7: 7.99,
    8: 8.99,
    9: 9.99,
    10: 10.99,
    11: 11.99,
    12: 12.99,
  };

  for (let i = 1; i <= MAX_INSTALLMENTS; i++) {
    const interestPercentage = interestRates[i] || 0;
    const totalWithInterest = totalPrice * (1 + interestPercentage / 100);
    const installmentValue = totalWithInterest / i;

    if (installmentValue < MIN_INSTALLMENT_VALUE) {
      // Se o valor da parcela for menor que R$ 6,00, paramos de adicionar parcelas
      break;
    }

    installments.push({
      installmentNumber: i,
      installmentValue: parseFloat(installmentValue.toFixed(2)),
      totalValue: parseFloat(totalWithInterest.toFixed(2)),
      interestPercentage: interestPercentage,
    });
  }

  return installments;
}

export function useInstallments({ totalPrice, enabled }: UseInstallmentsProps) {
  const [installments, setInstallments] = useState<InstallmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [debouncedPrice] = useDebounce(totalPrice, 500);

  useEffect(() => {
    console.log('useInstallments - enabled:', enabled, 'debouncedPrice:', debouncedPrice);
    
    if (!enabled || debouncedPrice <= 0) {
      console.log('useInstallments - Skipping fetch (enabled or price invalid)');
      setInstallments([]);
      return;
    }

    const fetchInstallments = async () => {
      console.log('useInstallments - Starting fetch for price:', debouncedPrice);
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          'calculate-installments',
          {
            body: { totalPrice: debouncedPrice },
          }
        );

        console.log('useInstallments - Response:', { data, error: functionError });

        if (functionError) {
          // Se houver um erro na chamada da função (incluindo falha de rede/comunicação)
          throw new Error(functionError.message || 'Failed to invoke calculate-installments function.');
        }

        if (data && data.installments && Array.isArray(data.installments) && data.installments.length > 0) {
          console.log('useInstallments - Setting installments from API:', data.installments);
          setInstallments(data.installments);
        } else {
          // Se a API não retornar parcelas, usar cálculo local
          console.log('useInstallments - API returned empty, using local calculation');
          const localInstallments = calculateInstallmentsLocally(debouncedPrice);
          setInstallments(localInstallments);
        }
      } catch (err: any) {
        console.error('useInstallments - Error, using local fallback:', err);
        // Em caso de erro (incluindo falha de rede), usar cálculo local
        const localInstallments = calculateInstallmentsLocally(debouncedPrice);
        setInstallments(localInstallments);
        setError("Não foi possível calcular as parcelas com o servidor. Usando cálculo padrão.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstallments();
  }, [debouncedPrice, enabled]);

  return { installments, isLoading, error };
}
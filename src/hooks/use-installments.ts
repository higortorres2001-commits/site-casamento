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
  enabled: boolean; // Só calcula se o método de pagamento for cartão
}

export function useInstallments({ totalPrice, enabled }: UseInstallmentsProps) {
  const [installments, setInstallments] = useState<InstallmentOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce de 500ms - só chama a API depois que o preço parar de mudar
  const [debouncedPrice] = useDebounce(totalPrice, 500);

  useEffect(() => {
    // Só busca parcelas se:
    // 1. O método de pagamento for cartão (enabled = true)
    // 2. O preço for maior que zero
    if (!enabled || debouncedPrice <= 0) {
      setInstallments([]);
      return;
    }

    const fetchInstallments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: functionError } = await supabase.functions.invoke(
          'calculate-installments',
          {
            body: { totalPrice: debouncedPrice },
          }
        );

        if (functionError) {
          throw functionError;
        }

        if (data && data.installments) {
          setInstallments(data.installments);
        } else {
          throw new Error('Resposta inválida da API');
        }
      } catch (err: any) {
        console.error('Erro ao calcular parcelas:', err);
        setError(err.message || 'Erro ao calcular parcelas');
        setInstallments([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInstallments();
  }, [debouncedPrice, enabled]);

  return { installments, isLoading, error };
}
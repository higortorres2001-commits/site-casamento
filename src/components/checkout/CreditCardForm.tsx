"use client";

import React, { useImperativeHandle, forwardRef, useEffect, useState } from "react";
import { Input } from "@/components/ui/input"; // Still use Input for holderName
import { FormLabel, FormMessage } from "@/components/ui/form"; // For labels and messages
import { showError } from "@/utils/toast";
import Asaas from "@asaas/asaas-js"; // Import Asaas.js

export interface CreditCardFormRef {
  tokenizeCard: () => Promise<{ creditCardToken: string; holderName: string } | null>;
  isValid: () => Promise<boolean>; // Add isValid to trigger Asaas.js validation
}

interface CreditCardFormProps {
  isLoading: boolean;
}

const CreditCardForm = forwardRef<CreditCardFormRef, CreditCardFormProps>(
  ({ isLoading }, ref) => {
    const [holderName, setHolderName] = useState("");
    const [holderNameError, setHolderNameError] = useState<string | null>(null);
    const [asaasInitialized, setAsaasInitialized] = useState(false);

    useEffect(() => {
      const initializeAsaas = async () => {
        const publicApiKey = import.meta.env.VITE_ASAAS_PUBLIC_API_KEY;
        if (!publicApiKey) {
          console.error("VITE_ASAAS_PUBLIC_API_KEY is not set. Asaas.js cannot be initialized.");
          showError("Erro de configuração: Chave pública do Asaas não encontrada.");
          return;
        }

        try {
          await Asaas.init({
            environment: publicApiKey.startsWith('dev') ? 'sandbox' : 'production', // Adjust based on your key prefix or explicit env var
            credential: publicApiKey,
          });
          console.log("Asaas.js initialized successfully.");

          // Render card fields
          Asaas.createCreditCardFields({
            holderName: "#asaas-holder-name",
            cardNumber: "#asaas-card-number",
            expiryMonth: "#asaas-expiry-month",
            expiryYear: "#asaas-expiry-year",
            ccv: "#asaas-ccv",
          });
          setAsaasInitialized(true);
        } catch (error: any) {
          console.error("Error initializing Asaas.js:", error);
          showError("Erro ao inicializar o Asaas. Por favor, tente novamente.");
        }
      };

      if (!asaasInitialized) {
        initializeAsaas();
      }
    }, [asaasInitialized]);

    useImperativeHandle(ref, () => ({
      tokenizeCard: async () => {
        if (!asaasInitialized) {
          showError("Asaas.js não está inicializado. Tente novamente.");
          return null;
        }
        if (!holderName.trim()) {
          setHolderNameError("O nome no cartão é obrigatório.");
          return null;
        } else {
          setHolderNameError(null);
        }

        try {
          const { creditCardToken, hasError, errors } = await Asaas.tokenizeCreditCard();

          if (hasError) {
            console.error("Asaas tokenization errors:", errors);
            const errorMessage = errors.map((err: any) => err.description).join(", ") || "Erro ao tokenizar o cartão.";
            showError(errorMessage);
            return null;
          }

          if (creditCardToken) {
            return { creditCardToken, holderName };
          }
          return null;
        } catch (error: any) {
          console.error("Unexpected error during Asaas tokenization:", error);
          showError("Erro inesperado ao tokenizar o cartão. Tente novamente.");
          return null;
        }
      },
      isValid: async () => {
        if (!asaasInitialized) return false;
        if (!holderName.trim()) {
          setHolderNameError("O nome no cartão é obrigatório.");
          return false;
        } else {
          setHolderNameError(null);
        }
        // Asaas.js tokenizeCreditCard also performs validation
        const { hasError } = await Asaas.tokenizeCreditCard();
        return !hasError;
      }
    }));

    return (
      <div className="space-y-4">
        <div>
          <FormLabel htmlFor="asaas-holder-name-input">Nome no Cartão</FormLabel>
          <Input
            id="asaas-holder-name-input" // Use a standard input for holder name
            placeholder="Nome Completo no Cartão"
            value={holderName}
            onChange={(e) => {
              setHolderName(e.target.value);
              if (e.target.value.trim()) setHolderNameError(null);
            }}
            disabled={isLoading || !asaasInitialized}
            className="focus:ring-orange-500 focus:border-orange-500"
          />
          {holderNameError && <FormMessage className="text-red-500">{holderNameError}</FormMessage>}
        </div>

        <div className="space-y-2">
          <FormLabel>Número do Cartão</FormLabel>
          <div id="asaas-card-number" className="border rounded-md p-2 min-h-[40px] flex items-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
            {/* Asaas.js will inject the secure iframe here */}
          </div>
          <FormMessage /> {/* Asaas.js will handle card number specific errors */}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <FormLabel>Mês (MM)</FormLabel>
            <div id="asaas-expiry-month" className="border rounded-md p-2 min-h-[40px] flex items-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
              {/* Asaas.js will inject the secure iframe here */}
            </div>
            <FormMessage />
          </div>
          <div className="space-y-2">
            <FormLabel>Ano (AA)</FormLabel>
            <div id="asaas-expiry-year" className="border rounded-md p-2 min-h-[40px] flex items-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
              {/* Asaas.js will inject the secure iframe here */}
            </div>
            <FormMessage />
          </div>
          <div className="space-y-2">
            <FormLabel>CVV</FormLabel>
            <div id="asaas-ccv" className="border rounded-md p-2 min-h-[40px] flex items-center focus-within:ring-2 focus-within:ring-orange-500 focus-within:border-orange-500">
              {/* Asaas.js will inject the secure iframe here */}
            </div>
            <FormMessage />
          </div>
        </div>
      </div>
    );
  }
);

CreditCardForm.displayName = "CreditCardForm";

export default CreditCardForm;
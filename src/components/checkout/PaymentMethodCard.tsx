"use client";

import React, { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CreditCardForm, { CreditCardFormRef } from "./CreditCardForm";

interface PaymentMethodCardProps {
  paymentMethod: "PIX" | "CREDIT_CARD";
  onPaymentMethodChange: (method: "PIX" | "CREDIT_CARD") => void;
  isLoading: boolean;
  totalPrice: number;
}

const PaymentMethodCard = forwardRef<CreditCardFormRef, PaymentMethodCardProps>(
  ({ paymentMethod, onPaymentMethodChange, isLoading, totalPrice }, ref) => {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
          <CardTitle className="text-xl text-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-bold">2</span>
            </div>
            Método de Pagamento
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Tabs value={paymentMethod} onValueChange={(value) => onPaymentMethodChange(value as "PIX" | "CREDIT_CARD")}>
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="PIX" className="flex items-center gap-2">
                <span className="text-lg">💳</span>
                PIX
              </TabsTrigger>
              <TabsTrigger value="CREDIT_CARD" className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                Cartão de Crédito
              </TabsTrigger>
            </TabsList>
            <TabsContent value="PIX" className="mt-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">⚡</span>
                  <h4 className="font-semibold text-green-800">Pagamento via PIX</h4>
                </div>
                <p className="text-sm text-green-700">
                  Você receberá um QR Code para pagamento instantâneo via PIX após finalizar o pedido.
                  O acesso é liberado automaticamente após a confirmação.
                </p>
              </div>
            </TabsContent>
            <TabsContent value="CREDIT_CARD" className="mt-4">
              <CreditCardForm
                ref={ref}
                isLoading={isLoading}
                totalPrice={totalPrice}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }
);

PaymentMethodCard.displayName = "PaymentMethodCard";

export default PaymentMethodCard;
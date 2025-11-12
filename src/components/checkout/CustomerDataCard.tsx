"use client";

import React, { forwardRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CheckoutForm, { CheckoutFormRef } from "./CheckoutForm";

interface CustomerDataCardProps {
  isLoading: boolean;
}

const CustomerDataCard = forwardRef<CheckoutFormRef, CustomerDataCardProps>(
  ({ isLoading }, ref) => {
    return (
      <Card className="bg-white shadow-lg">
        <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
          <CardTitle className="text-xl text-gray-800 flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <span className="text-orange-600 font-bold">1</span>
            </div>
            Seus Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <CheckoutForm
            ref={ref}
            onSubmit={() => {}}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>
    );
  }
);

CustomerDataCard.displayName = "CustomerDataCard";

export default CustomerDataCard;
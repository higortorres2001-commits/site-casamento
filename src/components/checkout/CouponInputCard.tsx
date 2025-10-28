"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Coupon } from "@/types";
import { Loader2 } from "lucide-react";

interface CouponInputCardProps {
  onCouponApplied: (coupon: Coupon | null) => void;
  currentTotalPrice: number;
}

const CouponInputCard = ({ onCouponApplied, currentTotalPrice }: CouponInputCardProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      showError("Por favor, insira um código de cupom.");
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("code", couponCode.trim())
      .eq("active", true)
      .single();

    if (error || !data) {
      showError("Cupom inválido ou inativo.");
      onCouponApplied(null); // Clear any previously applied coupon
      console.error("Error fetching coupon:", error);
    } else {
      showSuccess("Cupom aplicado com sucesso!");
      onCouponApplied(data);
    }
    setIsLoading(false);
  };

  return (
    <Card className="bg-white rounded-xl shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Cupom de Desconto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Insira seu cupom"
            className="flex-1 rounded-lg border-gray-300 focus:ring-orange-500 focus:border-orange-500"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            disabled={isLoading}
          />
          <Button
            variant="secondary"
            onClick={handleApplyCoupon}
            disabled={isLoading}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
          </Button>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
          <span className="text-lg font-bold text-gray-900">Total:</span>
          <span className="text-2xl font-extrabold text-gray-900">R$ {currentTotalPrice.toFixed(2)}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default CouponInputCard;
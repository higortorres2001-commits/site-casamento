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
  // currentTotalPrice: number; // Removed as it's redundant
}

const CouponInputCard = ({ onCouponApplied }: CouponInputCardProps) => {
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
        <CardTitle className="text-xl font-bold text-gray-800">Cupom de Desconto</CardTitle>
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
        {/* Removed redundant total price display */}
      </CardContent>
    </Card>
  );
};

export default CouponInputCard;
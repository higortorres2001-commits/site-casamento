"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Coupon } from "@/types";
import { Loader2, ChevronDown, ChevronUp, Tag } from "lucide-react";

interface CouponInputCardProps {
  onCouponApplied: (coupon: Coupon | null) => void;
}

const CouponInputCard = ({ onCouponApplied }: CouponInputCardProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

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
      setCouponCode(""); // Clear input after successful application
    }
    setIsLoading(false);
  };

  const handleToggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  // Se não estiver expandido, mostra apenas o link
  if (!isExpanded) {
    return (
      <div className="text-center">
        <button
          onClick={handleToggleExpanded}
          className="text-orange-600 hover:text-orange-700 text-sm font-medium underline transition-colors"
        >
          Possui um cupom de desconto? Clique aqui
        </button>
      </div>
    );
  }

  // Se estiver expandido, mostra o campo completo
  return (
    <Card className="bg-white rounded-xl shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Tag className="h-5 w-5 text-orange-500" />
            Cupom de Desconto
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleExpanded}
            className="text-gray-500 hover:text-gray-700"
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Digite seu cupom"
            className="flex-1 rounded-lg border-gray-300 focus:ring-orange-500 focus:border-orange-500"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            disabled={isLoading}
            autoFocus // Auto focus when expanded
          />
          <Button
            variant="secondary"
            onClick={handleApplyCoupon}
            disabled={isLoading || !couponCode.trim()}
            className="bg-gray-200 hover:bg-gray-300 text-gray-800"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
          </Button>
        </div>
        <p className="text-xs text-gray-500">
          Digite o código e clique em aplicar para validar seu desconto.
        </p>
      </CardContent>
    </Card>
  );
};

export default CouponInputCard;
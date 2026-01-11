"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { GUEST_MESSAGES, VALIDATION_MESSAGES } from "@/constants/messages";
import { Coupon } from "@/types";
import { Loader2, ChevronDown, ChevronUp, Tag, X } from "lucide-react";

interface CouponInputCardProps {
  onCouponApplied: (coupon: Coupon | null) => void;
  appliedCoupon?: Coupon | null;
}

const CouponInputCard = ({ onCouponApplied, appliedCoupon }: CouponInputCardProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleApplyCoupon = async () => {
    console.log("🎯 CouponInputCard - Aplicando cupom:", couponCode.trim());

    if (!couponCode.trim()) {
      showError(VALIDATION_MESSAGES.REQUIRED_FIELDS);
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
      console.log("❌ Cupom inválido:", error);
      showError(GUEST_MESSAGES.error.GENERIC);
      onCouponApplied(null); // Clear any previously applied coupon
      console.log("🔄 Cupom removido do estado pai");
    } else {
      console.log("✅ Cupom válido encontrado:", data);
      showSuccess(GUEST_MESSAGES.success.RESERVATION_CREATED);
      onCouponApplied(data); // ✅ PASSANDO O CUPOM VÁLIDO
      console.log("🔄 Cupom aplicado no estado pai:", data);
      setCouponCode(""); // Clear input after successful application
    }
    setIsLoading(false);
  };

  const handleRemoveCoupon = () => {
    console.log("🗑️ CouponInputCard - Removendo cupom");
    onCouponApplied(null);
    setCouponCode(""); // Clear input when removing coupon
    setIsExpanded(false); // Collapse when removing coupon
    console.log("🔄 Cupom removido do estado pai");
  };

  const handleToggleExpanded = () => {
    console.log("🔄 CouponInputCard - Toggle expanded:", !isExpanded);
    setIsExpanded(!isExpanded);
  };

  // Se há um cupom aplicado, mostra o cupom aplicado
  if (appliedCoupon) {
    console.log("🎯 CouponInputCard - Renderizando cupom aplicado:", appliedCoupon);
    return (
      <Card className="bg-white rounded-xl shadow-lg border-green-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <Tag className="h-5 w-5 text-green-600" />
              Cupom Aplicado
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRemoveCoupon}
              className="text-red-600 hover:text-red-800 hover:bg-red-50"
              title="Remover cupom"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
              <span className="font-semibold text-green-800">{appliedCoupon.code}</span>
            </div>
            <div className="text-right">
              {appliedCoupon.discount_type === "percentage" ? (
                <span className="text-green-700 font-medium">
                  -{appliedCoupon.value}% OFF
                </span>
              ) : (
                <span className="text-green-700 font-medium">
                  -R$ {appliedCoupon.value.toFixed(2)}
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500">
            Cupom aplicado com sucesso! Clique no X para remover.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Se não estiver expandido, mostra apenas o link
  if (!isExpanded) {
    console.log("🎯 CouponInputCard - Renderizando link expansivo");
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
  console.log("🎯 CouponInputCard - Renderizando campo de input");
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
"use client";

import React, { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Coupon } from "@/types";
import { Loader2, Tag, X } from "lucide-react";

interface CouponInputCardProps {
  onCouponApplied: (coupon: Coupon | null) => void;
  appliedCoupon?: Coupon | null;
}

const CouponInputCard = ({ onCouponApplied, appliedCoupon }: CouponInputCardProps) => {
  const [couponCode, setCouponCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  // ✅ OTIMIZAÇÃO: useCallback para evitar re-criação
  const handleApplyCoupon = useCallback(async () => {
    console.log("🎯 CouponInputCard - Aplicando cupom:", couponCode.trim());
    
    const trimmedCode = couponCode.trim().toUpperCase();
    
    if (!trimmedCode) {
      showError("Por favor, insira um código de cupom.");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .eq("code", trimmedCode)
        .eq("active", true)
        .single();

      if (error || !data) {
        console.log("❌ Cupom inválido:", error);
        showError("Cupom inválido ou inativo.");
        onCouponApplied(null);
        console.log("🔄 Cupom removido do estado pai");
      } else {
        console.log("✅ Cupom válido encontrado:", data);
        showSuccess("Cupom aplicado com sucesso!");
        onCouponApplied(data);
        console.log("🔄 Cupom aplicado no estado pai:", data);
        setCouponCode("");
        setIsExpanded(false); // ✅ Colapsar após aplicar
      }
    } catch (err: any) {
      console.error("Erro ao aplicar cupom:", err);
      showError("Erro ao validar cupom.");
    } finally {
      setIsLoading(false);
    }
  }, [couponCode, onCouponApplied]);

  const handleRemoveCoupon = useCallback(() => {
    console.log("🗑️ CouponInputCard - Removendo cupom");
    onCouponApplied(null);
    setCouponCode("");
    setIsExpanded(false);
    console.log("🔄 Cupom removido do estado pai");
  }, [onCouponApplied]);

  const handleToggleExpanded = useCallback(() => {
    console.log("🔄 CouponInputCard - Toggle expanded:", !isExpanded);
    setIsExpanded(!isExpanded);
  }, [isExpanded]);

  // ✅ Enter key para aplicar cupom
  const handleKeyPress = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && couponCode.trim()) {
      e.preventDefault();
      handleApplyCoupon();
    }
  }, [couponCode, handleApplyCoupon]);

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
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Digite seu cupom"
            className="flex-1 rounded-lg border-gray-300 focus:ring-orange-500 focus:border-orange-500 uppercase"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            autoFocus
            maxLength={20}
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
          Digite o código e pressione Enter ou clique em aplicar.
        </p>
      </CardContent>
    </Card>
  );
});

CouponInputCard.displayName = "CouponInputCard";

export default CouponInputCard;
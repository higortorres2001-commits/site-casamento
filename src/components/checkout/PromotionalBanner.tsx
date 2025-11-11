"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Product } from "@/types";

interface PromotionalBannerProps {
  product: Product;
  customMessage?: string;
  customTitle?: string;
  backgroundColor?: string;
  textColor?: string;
}

const PromotionalBanner = ({
  product,
  customMessage,
  customTitle,
  backgroundColor = "from-orange-50 to-yellow-50",
  textColor = "text-orange-800"
}: PromotionalBannerProps) => {
  return (
    <Card className={`bg-gradient-to-r ${backgroundColor} border-orange-200 shadow-lg`}>
      <CardHeader>
        <CardTitle className={`text-xl font-bold ${textColor}`}>
          🎯 {customTitle || "Oferta Especial por Tempo Limitado!"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`${textColor} mb-4`}>
          {customMessage || `Adquira agora ${product.name} e tenha acesso imediato aos materiais exclusivos!`}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
            ✅ Entrega Imediata
          </Badge>
          <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
            📚 Materiais Exclusivos
          </Badge>
          <Badge className="bg-purple-100 text-purple-800 text-sm px-3 py-1">
            🎓 Suporte Premium
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
};

export default PromotionalBanner;
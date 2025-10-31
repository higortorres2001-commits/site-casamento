"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";

const AdditionalInfoCard = () => {
  return (
    <Card className="bg-white rounded-xl shadow-lg">
      <CardContent className="p-6 space-y-2">
        <p className="text-base font-semibold text-gray-800">ACESSO IMEDIATO</p>
        <p className="text-base font-semibold text-gray-800">GARANTIA DE 7 DIAS</p>
        <p className="text-base font-semibold text-gray-800">
          PAGAMENTO PROCESSADO POR ESCRITORIO CHEIO CNPJ N  44.962.282/0001-83 HIGOR R T S
        </p>
      </CardContent>
    </Card>
  );
};

export default AdditionalInfoCard;
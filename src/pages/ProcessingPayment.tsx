"use client";

import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ProcessingPayment = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <Card className="bg-white rounded-xl shadow-lg max-w-md mx-auto p-6 text-center">
        <CardHeader className="pb-4">
          <Loader2 className="h-16 w-16 animate-spin text-orange-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-gray-800">
            Aguardando Confirmação de Pagamento...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Assim que o pagamento for confirmado, seu acesso será liberado automaticamente.
          </p>
          <p className="text-sm text-gray-500">
            Isso pode levar alguns minutos. Por favor, não feche esta página.
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full mt-4">
              Ainda não liberou? Ir para a tela de Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingPayment;
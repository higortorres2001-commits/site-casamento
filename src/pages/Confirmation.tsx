"use client";

import React from "react";
import { Link } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const Confirmation = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <Card className="bg-white rounded-xl shadow-lg max-w-md mx-auto p-6 text-center">
        <CardHeader className="pb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-gray-800">
            Pagamento Recebido!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Agradecemos a sua compra! Seu acesso aos produtos será liberado em breve.
          </p>
          <p className="text-sm text-gray-500">
            Você receberá um e-mail com os detalhes de acesso e login.
          </p>
          <Link to="/meus-produtos">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-4">
              Ir para Meus Produtos
            </Button>
          </Link>
          <Link to="/">
            <Button variant="outline" className="w-full mt-2">
              Voltar para o Início
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;
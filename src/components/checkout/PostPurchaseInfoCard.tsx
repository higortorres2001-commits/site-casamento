"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const PostPurchaseInfoCard = () => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl text-blue-800 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <span className="text-2xl">📋</span>
          </div>
          Como acessar seus materiais após a compra
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              1
            </div>
            <div>
              <h4 className="font-semibold text-blue-800">Confirmação do Pagamento</h4>
              <p className="text-sm text-blue-700">
                Após a confirmação do pagamento, você será automaticamente redirecionado.
              </p>
            </div>
          </div>

          <Separator className="bg-blue-200" />

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              2
            </div>
            <div>
              <h4 className="font-semibold text-blue-800">Acesso à Plataforma</h4>
              <p className="text-sm text-blue-700">
                Você será direcionado para fazer login com seu e-mail e a senha será seu CPF.
              </p>
            </div>
          </div>

          <Separator className="bg-blue-200" />

          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mt-0.5">
              3
            </div>
            <div>
              <h4 className="font-semibold text-blue-800">Download dos Materiais</h4>
              <p className="text-sm text-blue-700">
                Na sua área de membros, você terá acesso vitalício para baixar todos os materiais.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-white/50 rounded-lg border border-blue-200">
          <div className="flex flex-wrap gap-2 justify-center">
            <Badge className="bg-green-100 text-green-800 border-green-200">
              ✅ Acesso Vitalício
            </Badge>
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              📱 Multiplataforma
            </Badge>
            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
              🔒 100% Seguro
            </Badge>
          </div>
        </div>

        <div className="text-center">
          <p className="text-xs text-blue-600 font-medium">
            💡 Dica: Recomendamos trocar sua senha no primeiro acesso para maior segurança
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default PostPurchaseInfoCard;
"use client";

import React, { useEffect, useState } from "react";
import { useLocation, useParams, Link } from "react-router-dom";
import { CheckCircle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { showError, showSuccess } from "@/utils/toast";

const PaymentSuccess = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const location = useLocation();
  const [pixDetails, setPixDetails] = useState<any>(null);
  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (location.state && location.state.pix && location.state.total) {
      setPixDetails(location.state.pix);
      setTotalPrice(location.state.total);
      setIsLoading(false);
    } else {
      showError("Detalhes do pagamento não encontrados. Por favor, verifique seu histórico de pedidos.");
      setIsLoading(false);
    }
  }, [location.state]);

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(message))
      .catch(() => showError("Falha ao copiar."));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!pixDetails) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Erro no Pagamento</h1>
        <p className="text-lg text-gray-600 mb-6">Não foi possível carregar os detalhes do PIX.</p>
        <Link to="/">
          <Button className="bg-orange-500 hover:bg-orange-600 text-white">
            Voltar para o Início
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <Card className="bg-white rounded-xl shadow-lg max-w-md mx-auto p-6 text-center">
        <CardHeader className="pb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-gray-800">
            Pagamento Pendente
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Seu pedido <span className="font-semibold">#{orderId?.substring(0, 8)}</span> foi gerado com sucesso!
          </p>
          <p className="text-xl font-bold text-gray-900">
            Total a pagar: R$ {totalPrice.toFixed(2)}
          </p>

          {pixDetails.encodedImage && (
            <div className="flex flex-col items-center space-y-4">
              <p className="text-gray-700 font-medium">Escaneie o QR Code para pagar:</p>
              <img
                src={`data:image/png;base64,${pixDetails.encodedImage}`}
                alt="QR Code PIX"
                className="w-48 h-48 border border-gray-200 rounded-md"
              />
            </div>
          )}

          {pixDetails.payload && (
            <div className="space-y-2">
              <p className="text-gray-700 font-medium">Ou copie e cole o código PIX:</p>
              <div className="flex items-center border rounded-md p-2 bg-gray-50">
                <span className="flex-1 text-sm text-gray-800 break-all pr-2">
                  {pixDetails.payload}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(pixDetails.payload, "Código PIX copiado!")}
                  className="ml-2"
                >
                  <Copy className="h-5 w-5 text-gray-600 hover:text-orange-500" />
                </Button>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            Assim que o pagamento for confirmado, você receberá um e-mail com os detalhes de acesso.
          </p>

          <Link to="/meus-produtos">
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-4">
              Ir para Meus Produtos
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccess;
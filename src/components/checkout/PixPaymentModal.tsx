"use client";

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  pixDetails: any;
  totalPrice: number;
}

const PixPaymentModal = ({
  isOpen,
  onClose,
  orderId,
  pixDetails,
  totalPrice,
}: PixPaymentModalProps) => {
  const navigate = useNavigate();

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(message))
      .catch(() => showError("Falha ao copiar."));
  };

  const handleGoToConfirmation = () => {
    onClose(); // Close the modal
    navigate("/confirmacao"); // Redirect to the confirmation page
  };

  if (!pixDetails) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] text-center">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-gray-800">Erro no Pagamento</DialogTitle>
            <DialogDescription className="text-lg text-gray-600">
              Não foi possível carregar os detalhes do PIX.
            </DialogDescription>
          </DialogHeader>
          <Button onClick={onClose} className="bg-orange-500 hover:bg-orange-600 text-white">
            Fechar
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6 text-center">
        <DialogHeader className="pb-4">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <DialogTitle className="text-3xl font-bold text-gray-800">
            Pagamento Pendente
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-700">
            Seu pedido <span className="font-semibold">#{orderId?.substring(0, 8)}</span> foi gerado com sucesso!
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
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

          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
              onClick={() => copyToClipboard(pixDetails.payload, "Código PIX copiado!")}
            >
              Copiar Código PIX
            </Button>
            <Button
              variant="secondary"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg shadow-md py-3 text-lg"
              onClick={handleGoToConfirmation}
            >
              Já paguei, ir para o acesso
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
"use client";

import React, { useEffect, useRef, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client"; // Import supabase client

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  pixDetails: any;
  totalPrice: number;
  asaasPaymentId: string; // New prop: Asaas payment ID
}

const PixPaymentModal = ({
  isOpen,
  onClose,
  orderId,
  pixDetails,
  totalPrice,
  asaasPaymentId,
}: PixPaymentModalProps) => {
  const navigate = useNavigate();
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null); // Ref for the timeout
  const [isPolling, setIsPolling] = useState(false);

  const checkPaymentStatus = async () => {
    if (!asaasPaymentId) {
      console.error("Asaas Payment ID is missing for status check.");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { payment_id: asaasPaymentId },
      });

      if (error) {
        console.error("Error checking payment status:", error);
        // showError("Erro ao verificar status do pagamento."); // Avoid spamming toasts
      } else if (data && (data.status === "CONFIRMED" || data.status === "RECEIVED")) {
        showSuccess("Seu pagamento foi confirmado!");
        stopPolling();
        onClose(); // Close the modal
        navigate("/confirmacao");
      } else {
        console.log("Payment status still pending:", data?.status);
      }
    } catch (err: any) {
      console.error("Unexpected error during payment status check:", err);
      // showError("Erro inesperado ao verificar status do pagamento.");
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    setIsPolling(true);
    // Check immediately, then every 5 seconds
    checkPaymentStatus();
    pollingIntervalRef.current = setInterval(checkPaymentStatus, 5000) as unknown as number;

    // Set a timeout to stop polling after 10 minutes (600,000 ms)
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
      showError("A verificação do pagamento expirou. Por favor, verifique seu e-mail para confirmação.");
      onClose(); // Close modal if polling stops due to timeout
      navigate("/processando-pagamento"); // Redirect to a generic processing page
    }, 600000) as unknown as number; // 10 minutes
  };

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setIsPolling(false);
  };

  useEffect(() => {
    if (isOpen) {
      startPolling(); // Start polling when modal opens
    } else {
      stopPolling(); // Stop polling when modal closes
    }
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [isOpen, navigate]); // Added navigate to dependencies

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => showSuccess(message))
      .catch(() => showError("Falha ao copiar."));
  };

  const handleGoToProcessing = () => {
    onClose(); // Close the modal
    navigate("/processando-pagamento"); // Redirect to the new processing payment page
  };

  if (!pixDetails) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[425px] text-center max-h-[90vh] overflow-y-auto">
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
      <DialogContent className="sm:max-w-md p-6 text-center max-h-[90vh] overflow-y-auto">
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
              onClick={startPolling} // Start polling when this button is clicked
              disabled={isPolling}
            >
              {isPolling ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Verificando Pagamento...
                </>
              ) : (
                "Já paguei, verificar acesso"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
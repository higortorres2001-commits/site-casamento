"use client";

import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, Copy, Loader2, X, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  pixDetails: any;
  totalPrice: number;
  asaasPaymentId: string;
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
  const pollingTimeoutRef = useRef<number | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [pollingError, setPollingError] = useState<string | null>(null);
  const [pollingAttempts, setPollingAttempts] = useState(0);

  const checkPaymentStatus = async () => {
    if (!asaasPaymentId) {
      console.error("Asaas Payment ID is missing for status check.");
      return;
    }

    setPollingError(null);
    setPollingAttempts(prev => prev + 1);

    try {
      console.log(`🔍 Checking payment status (attempt ${pollingAttempts + 1}):`, asaasPaymentId);
      
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { payment_id: asaasPaymentId },
      });

      if (error) {
        console.error("❌ Error checking payment status:", error);
        setPollingError(`Erro ao verificar status: ${error.message}`);
        return;
      }

      console.log("📊 Payment status response:", data);

      if (data && (data.status === "CONFIRMED" || data.status === "RECEIVED")) {
        console.log("✅ Payment confirmed!");
        showSuccess("Seu pagamento foi confirmado!");
        stopPolling();
        onClose(); // Close modal
        navigate("/confirmacao");
      } else {
        console.log(`⏳ Payment still pending: ${data?.status}`);
        // Continuar polling
      }
    } catch (err: any) {
      console.error("❌ Unexpected error during payment status check:", err);
      setPollingError(`Erro inesperado: ${err.message}`);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    
    setIsPolling(true);
    setPollingError(null);
    setPollingAttempts(0);
    
    console.log("🔄 Starting payment status polling...");
    
    // Check immediately, then every 5 seconds
    checkPaymentStatus();
    pollingIntervalRef.current = setInterval(checkPaymentStatus, 5000) as unknown as number;
    
    // Set a timeout to stop polling after 10 minutes (600,000 ms)
    pollingTimeoutRef.current = setTimeout(() => {
      console.log("⏰ Polling timeout reached");
      setPollingError("Tempo de verificação expirou. Por favor, verifique seu e-mail para confirmação.");
      stopPolling();
    }, 600000) as unknown as number;
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

  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showSuccess(message);
      })
      .catch(() => {
        showError("Falha ao copiar.");
      });
  };

  const handleRetryPayment = () => {
    console.log("🔄 Retrying payment process...");
    stopPolling();
    onClose();
    // Recarregar a página para reiniciar o processo
    window.location.reload();
  };

  useEffect(() => {
    if (isOpen) {
      startPolling();
    } else {
      stopPolling();
    }
    // Cleanup on unmount
    return () => {
      stopPolling();
    };
  }, [isOpen, asaasPaymentId]);

  if (!pixDetails) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-6 text-center max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4">
            <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <DialogTitle className="text-2xl font-bold text-gray-800">
              Erro no Pagamento
            </DialogTitle>
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
          <div className="text-xl font-bold text-gray-900">
            Total a pagar: R$ {totalPrice.toFixed(2)}
          </div>

          {pixDetails.encodedImage && (
            <div className="space-y-4">
              <p className="text-gray-700 font-medium">Escaneie o QR Code para pagar:</p>
              <div className="flex justify-center">
                <img
                  src={`data:image/png;base64,${pixDetails.encodedImage}`}
                  alt="QR Code PIX"
                  className="w-48 h-48 border border-gray-200 rounded-md"
                />
              </div>
            </div>
          )}

          {pixDetails.payload && (
            <div className="space-y-4">
              <p className="text-gray-700 font-medium">Ou copie e cole o código PIX:</p>
              <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                <span className="flex-1 text-sm text-gray-800 break-all pr-2">
                  {pixDetails.payload}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => copyToClipboard(pixDetails.payload, "Código PIX copiado!")}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>
          )}

          <div className="text-sm text-gray-500 space-y-2">
            <p>Assim que o pagamento for confirmado, você receberá um e-mail com os detalhes de acesso.</p>
            <p>⏱️ A verificação é automática. Não feche esta página.</p>
          </div>

          {pollingError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center text-red-700">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Erro na verificação</span>
              </div>
              <p className="text-sm text-red-600">{pollingError}</p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetryPayment}
                  className="text-red-600 hover:text-red-800"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Tentar Novamente
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <X className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </div>
          )}

          {isPolling && (
            <div className="flex items-center justify-center space-x-2 text-blue-600">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm font-medium">
                Verificando pagamento... (tentativa {pollingAttempts})
              </span>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-6">
            <Button
              className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
              onClick={() => copyToClipboard(pixDetails.payload, "Código PIX copiado!")}
            >
              Copiar Código PIX
            </Button>
            <Button
              variant="secondary"
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg shadow-md py-3 text-lg"
              onClick={() => {
                console.log("🔄 Manual payment status check triggered");
                checkPaymentStatus();
              }}
            >
              Já paguei, verificar agora
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PixPaymentModal;
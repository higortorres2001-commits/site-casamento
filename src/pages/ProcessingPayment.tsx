"use client";

import React, { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";

const ProcessingPayment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isLoading: isSessionLoading } = useSession();
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);

  // Extrair asaasPaymentId da URL se disponível
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const paymentId = params.get('payment_id');
    if (paymentId) {
      setAsaasPaymentId(paymentId);
    }
  }, [location.search]);

  // Função para verificar o status do pagamento
  const checkPaymentStatus = async () => {
    if (!user || !asaasPaymentId) return;

    setIsCheckingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-payment-status", {
        body: { payment_id: asaasPaymentId },
      });

      if (error) {
        console.error("Error checking payment status:", error);
      } else if (data && (data.status === "CONFIRMED" || data.status === "RECEIVED")) {
        setPaymentConfirmed(true);
        showSuccess("Seu pagamento foi confirmado!");
        stopPolling();
        
        // Redirecionar após um breve delay para mostrar a mensagem de sucesso
        setTimeout(() => {
          navigate("/meus-produtos");
        }, 2000);
      }
    } catch (err: any) {
      console.error("Unexpected error during payment status check:", err);
    } finally {
      setIsCheckingPayment(false);
    }
  };

  // Iniciar polling quando o componente montar
  useEffect(() => {
    if (user && asaasPaymentId) {
      startPolling();
    } else if (!isSessionLoading && !user) {
      // Se não estiver logado, redirecionar para login
      navigate("/login");
    } else if (!isSessionLoading && user && !asaasPaymentId) {
      // Se estiver logado mas não tiver paymentId, verificar se o perfil tem acesso
      checkProfileAccess();
    }

    return () => {
      stopPolling();
    };
  }, [user, asaasPaymentId, isSessionLoading]);

  // Verificar se o perfil já tem acesso (caso o webhook tenha processado)
  const checkProfileAccess = async () => {
    if (!user) return;

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("access")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }

      if (profile && profile.access && profile.access.length > 0) {
        // Usuário já tem acesso, redirecionar para produtos
        navigate("/meus-produtos");
      }
    } catch (err) {
      console.error("Error checking profile access:", err);
    }
  };

  const startPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    
    // Verificar imediatamente e depois a cada 10 segundos
    checkPaymentStatus();
    pollingIntervalRef.current = setInterval(checkPaymentStatus, 10000) as unknown as number;

    // Definir um timeout para parar o polling após 10 minutos
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
    }
    pollingTimeoutRef.current = setTimeout(() => {
      stopPolling();
    }, 600000) as unknown as number; // 10 minutos
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
  };

  // Verificar manualmente o status do pagamento
  const handleManualCheck = () => {
    checkPaymentStatus();
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <Card className="bg-white rounded-xl shadow-lg max-w-md mx-auto p-6 text-center">
        <CardHeader className="pb-4">
          {paymentConfirmed ? (
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          ) : (
            <Loader2 className="h-16 w-16 animate-spin text-orange-500 mx-auto mb-4" />
          )}
          <CardTitle className="text-3xl font-bold text-gray-800">
            {paymentConfirmed 
              ? "Pagamento Confirmado!" 
              : "Aguardando Confirmação de Pagamento..."}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {paymentConfirmed ? (
            <p className="text-lg text-gray-700">
              Seu acesso foi liberado! Você será redirecionado para seus produtos.
            </p>
          ) : (
            <>
              <p className="text-lg text-gray-700">
                Assim que o pagamento for confirmado, seu acesso será liberado automaticamente.
              </p>
              <p className="text-sm text-gray-500">
                Isso pode levar alguns minutos. Você pode fechar esta página e voltar mais tarde.
              </p>
            </>
          )}
          
          <div className="flex flex-col gap-3">
            {!paymentConfirmed && (
              <Button 
                onClick={handleManualCheck} 
                disabled={isCheckingPayment}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isCheckingPayment ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" /> Verificando...
                  </>
                ) : (
                  "Verificar Novamente"
                )}
              </Button>
            )}
            
            <Link to="/meus-produtos">
              <Button variant="outline" className="w-full mt-4">
                Ir para Meus Produtos
              </Button>
            </Link>
            
            <Link to="/login">
              <Button variant="ghost" className="w-full">
                Ir para Login
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingPayment;
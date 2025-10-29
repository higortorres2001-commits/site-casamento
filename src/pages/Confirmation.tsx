"use client";

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { Profile } from "@/types";

const Confirmation = () => {
  const location = useLocation();
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);

  useEffect(() => {
    const fetchOrderData = async () => {
      setIsLoadingData(true);
      let currentOrderId: string | null = null;
      let currentTotalPrice: number | null = null;

      // Try to get orderId and totalPrice from location state (passed from Checkout)
      if (location.state && typeof location.state === 'object' && 'orderId' in location.state && 'totalPrice' in location.state) {
        currentOrderId = (location.state as { orderId: string, totalPrice: number }).orderId;
        currentTotalPrice = (location.state as { orderId: string, totalPrice: number }).totalPrice;
        setOrderId(currentOrderId);
        setTotalPrice(currentTotalPrice);
      }

      // If orderId is still null, try to get it from URL params (less ideal, but fallback)
      if (!currentOrderId) {
        const params = new URLSearchParams(location.search);
        currentOrderId = params.get('order_id');
        if (currentOrderId) {
          setOrderId(currentOrderId);
          // If orderId from URL, we might need to fetch totalPrice from DB
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select('total_price')
            .eq('id', currentOrderId)
            .single();
          if (orderError) {
            console.error("Error fetching order total price:", orderError);
            showError("Erro ao carregar detalhes do pedido.");
          } else if (orderData) {
            currentTotalPrice = orderData.total_price;
            setTotalPrice(currentTotalPrice);
          }
        }
      }
      setIsLoadingData(false);
    };

    if (!isSessionLoading) {
      fetchOrderData();
    }
  }, [location.state, location.search, user, isSessionLoading]);

  if (isLoadingData || isSessionLoading) {
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
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-gray-800">
            Pagamento Recebido!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Agradecemos a sua compra! Seu acesso aos produtos será liberado em breve.
          </p>
          {orderId && totalPrice !== null && (
            <div className="text-md text-gray-600">
              <p>Pedido: <span className="font-semibold">#{orderId.substring(0, 8)}</span></p>
              <p>Total Pago: <span className="font-semibold">R$ {totalPrice.toFixed(2)}</span></p>
            </div>
          )}
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
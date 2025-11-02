"use client";

import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { showError } from "@/utils/toast";
import { trackPurchase } from "@/utils/metaPixel";
import { Profile } from "@/types";

// Declare global fbq type for TypeScript
declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

const Confirmation = () => {
  const location = useLocation();
  const { user, isLoading: isSessionLoading } = useSession();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [totalPrice, setTotalPrice] = useState<number | null>(null);
  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>(null);

  useEffect(() => {
    const fetchOrderAndProfileData = async () => {
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

      // Fetch user profile for hashed data
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('name, cpf, email, whatsapp')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error("Error fetching user profile for Meta Pixel:", error);
          showError("Erro ao carregar dados do seu perfil.");
        } else if (data) {
          setUserProfile(data);
        }
      }
      setIsLoadingData(false);

      // Track Purchase event if all data is available and in production
      if (currentOrderId && currentTotalPrice !== null && user && data && process.env.NODE_ENV === 'production') {
        const firstName = data.name?.split(' ')[0] || null;
        const lastName = data.name?.split(' ').slice(1).join(' ') || null;

        trackPurchase(
          currentTotalPrice,
          'BRL',
          currentOrderId,
          {
            email: data.email,
            phone: data.whatsapp,
            firstName: firstName,
            lastName: lastName,
          }
        );
      }
    };

    if (!isSessionLoading) {
      fetchOrderAndProfileData();
    }
  }, [location.state, location.search, user, isSessionLoading]);

  // Loading state
  if (isLoadingData || isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <CardTitle className="text-2xl font-bold text-gray-800">
            Compra Confirmada!
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {orderId && (
            <p className="text-gray-600">
              Número do pedido: <span className="font-semibold">{orderId.substring(0, 8)}</span>
            </p>
          )}
          {totalPrice && (
            <p className="text-xl font-bold text-gray-900">
              Total: R$ {totalPrice.toFixed(2)}
            </p>
          )}
          <p className="text-gray-600">
            Você receberá um e-mail com os detalhes de acesso em breve.
          </p>
          <div className="flex flex-col space-y-2">
            <Link to="/meus-produtos" className="w-full">
              <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                Acessar Meus Produtos
              </Button>
            </Link>
            <Link to="/" className="w-full">
              <Button variant="outline" className="w-full">
                Voltar para Início
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Confirmation;
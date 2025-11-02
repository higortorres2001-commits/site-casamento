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

  // Rest of the component remains the same
  // ... (keep all other code from the previous Confirmation component)

  return (
    // Existing return statement from the previous implementation
  );
};

export default Confirmation;
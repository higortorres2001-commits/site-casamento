"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { useSession } from "@/components/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import OrderSummaryCard from "@/components/checkout/OrderSummaryCard";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
import CouponInputCard from "@/components/checkout/CouponInputCard";
import CheckoutForm from "@/components/checkout/CheckoutForm";

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const isMobile = useIsMobile();

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [currentTotalPrice, setCurrentTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<{ name?: string; cpf?: string; email?: string; whatsapp?: string; } | null>(null);

  const fetchProductDetails = useCallback(async () => {
    if (!productId) {
      showError("ID do produto não fornecido.");
      navigate("/");
      return;
    }

    setIsLoading(true);
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (productError || !productData) {
      showError("Produto não encontrado ou erro ao carregar.");
      console.error("Error fetching main product:", productError);
      navigate("/");
      return;
    }
    setMainProduct(productData);

    // Fetch order bumps if they exist
    if (productData.orderbumps && productData.orderbumps.length > 0) {
      const { data: orderBumpsData, error: orderBumpsError } = await supabase
        .from("products")
        .select("*")
        .in("id", productData.orderbumps);

      if (orderBumpsError) {
        console.error("Error fetching order bumps:", orderBumpsError);
      } else {
        setOrderBumps(orderBumpsData || []);
      }
    }
    setIsLoading(false);
  }, [productId, navigate]);

  const fetchUserProfile = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('name, cpf, email')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
      } else if (data) {
        setUserProfile({
          name: data.name || '',
          cpf: data.cpf || '',
          email: data.email || user.email || '',
          whatsapp: '', // WhatsApp is not in profile, user will fill
        });
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchProductDetails();
      fetchUserProfile();
    }
  }, [isSessionLoading, fetchProductDetails, fetchUserProfile]);

  // Recalculate total price whenever relevant state changes
  useEffect(() => {
    if (!mainProduct) return;

    let total = mainProduct.price;

    selectedOrderBumps.forEach((bumpId) => {
      const bumpProduct = orderBumps.find((p) => p.id === bumpId);
      if (bumpProduct) {
        total += bumpProduct.price;
      }
    });

    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        total = total * (1 - appliedCoupon.value / 100);
      } else if (appliedCoupon.discount_type === "fixed") {
        total = Math.max(0, total - appliedCoupon.value);
      }
    }
    setCurrentTotalPrice(total);
  }, [mainProduct, selectedOrderBumps, orderBumps, appliedCoupon]);

  const handleToggleOrderBump = (bumpId: string, isSelected: boolean) => {
    if (isSelected) {
      setSelectedOrderBumps((prev) => [...prev, bumpId]);
    } else {
      setSelectedOrderBumps((prev) => prev.filter((id) => id !== bumpId));
    }
  };

  const handleCouponApplied = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
  };

  const handleCheckoutSubmit = async (formData: { name: string; cpf: string; email: string; whatsapp: string }) => {
    if (!user) {
      showError("Você precisa estar logado para finalizar a compra.");
      navigate("/login");
      return;
    }
    if (!mainProduct) {
      showError("Nenhum produto principal selecionado.");
      return;
    }

    setIsSubmitting(true);

    const productIdsToPurchase = [mainProduct.id, ...selectedOrderBumps];

    try {
      // First, update user profile with new data if available
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({
          name: formData.name,
          cpf: formData.cpf,
          email: formData.email,
        })
        .eq('id', user.id);

      if (profileUpdateError) {
        console.error("Error updating user profile:", profileUpdateError);
        // Don't block checkout, but log the error
      }

      // Then, invoke the Edge Function to create payment
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          userId: user.id,
          productIds: productIdsToPurchase,
          coupon_code: appliedCoupon?.code,
        },
      });

      if (error) {
        showError("Erro ao criar pagamento: " + error.message);
        console.error("Edge Function error:", error);
      } else if (data && data.pix) {
        showSuccess("Pagamento PIX criado com sucesso!");
        // Redirect to PIX payment details or show QR code
        navigate(`/payment-success/${data.id}`, { state: { pix: data.pix, total: currentTotalPrice } });
      } else {
        showError("Erro desconhecido ao processar pagamento.");
        console.error("Unexpected response from Edge Function:", data);
      }
    } catch (error: any) {
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error during checkout:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!mainProduct) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <p className="text-xl text-gray-600">Produto não encontrado.</p>
      </div>
    );
  }

  const summaryContent = (
    <div className="space-y-6">
      <OrderSummaryCard product={mainProduct} />
      {orderBumps.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-gray-800">Adicione mais ao seu pedido:</h2>
          {orderBumps.map((bump) => (
            <OrderBumpCard
              key={bump.id}
              product={bump}
              isSelected={selectedOrderBumps.includes(bump.id)}
              onToggle={handleToggleOrderBump}
            />
          ))}
        </div>
      )}
      <CouponInputCard
        onCouponApplied={handleCouponApplied}
        currentTotalPrice={currentTotalPrice}
      />
    </div>
  );

  const formContent = (
    <div className="bg-white p-6 rounded-xl shadow-lg">
      <CheckoutForm onSubmit={handleCheckoutSubmit} isLoading={isSubmitting} initialData={userProfile || undefined} />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <h1 className="text-4xl font-bold text-center mb-8">Finalizar Compra</h1>
      {isMobile ? (
        <div className="space-y-8">
          <div className="bg-blue-100 p-6 rounded-xl shadow-lg">
            {summaryContent}
          </div>
          {formContent}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-6xl mx-auto">
          <div className="col-span-1 bg-white p-6 rounded-xl shadow-lg">
            {formContent}
          </div>
          <div className="col-span-1 bg-blue-100 p-6 rounded-xl shadow-lg">
            {summaryContent}
          </div>
        </div>
      )}
    </div>
  );
};

export default Checkout;
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
import { formatCPF } from "@/utils/cpfValidation";
import PixPaymentModal from "@/components/checkout/PixPaymentModal"; // Import the new modal component

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
  const [userProfile, setUserProfile] = useState<{ name?: string; cpf?: string; email?: string; } | null>(null);

  // State for the PIX payment modal
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [modalPixDetails, setModalPixDetails] = useState<any>(null);
  const [modalTotalPrice, setModalTotalPrice] = useState<number>(0);
  const [modalOrderId, setModalOrderId] = useState<string>("");

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
          cpf: data.cpf ? formatCPF(data.cpf) : '',
          email: data.email || user.email || '',
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

  const handleCheckoutSubmit = async (formData: { name: string; cpf: string; email: string }) => {
    if (!mainProduct) {
      showError("Nenhum produto principal selecionado.");
      return;
    }

    setIsSubmitting(true);

    const productIdsToPurchase = [mainProduct.id, ...selectedOrderBumps];
    const cleanedCpf = formData.cpf.replace(/[^\d]+/g, "");

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          name: formData.name,
          email: formData.email,
          cpf: cleanedCpf,
          productIds: productIdsToPurchase,
          coupon_code: appliedCoupon?.code,
        },
      });

      if (error) {
        showError("Erro ao criar pagamento: " + error.message);
        console.error("Edge Function error:", error);
      } else if (data && data.pix && data.id) {
        showSuccess("Pagamento PIX criado com sucesso!");
        setModalPixDetails(data.pix);
        setModalTotalPrice(currentTotalPrice);
        setModalOrderId(data.id);
        setIsPixModalOpen(true); // Open the modal
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

      {/* PIX Payment Modal */}
      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        orderId={modalOrderId}
        pixDetails={modalPixDetails}
        totalPrice={modalTotalPrice}
      />
    </div>
  );
};

export default Checkout;
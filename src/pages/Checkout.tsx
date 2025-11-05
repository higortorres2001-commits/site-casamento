"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import MainProductDisplayCard from "@/components/checkout/MainProductDisplayCard";
import SmartCheckoutForm from "@/components/checkout/SmartCheckoutForm";
import CreditCardForm, { CreditCardFormRef } from "@/components/checkout/CreditCardForm";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
import CouponInputCard from "@/components/checkout/CouponInputCard";
import OrderSummaryAccordion from "@/components/checkout/OrderSummaryAccordion";
import FixedBottomBar from "@/components/checkout/FixedBottomBar";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import { useSession } from "@/components/SessionContextProvider";
import { useMetaTrackingData } from "@/hooks/use-meta-tracking-data";
import { trackInitiateCheckout } from "@/utils/metaPixel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const metaTrackingData = useMetaTrackingData();

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixDetails, setPixDetails] = useState<any>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);
  const [orderId, setOrderId] = useState<string | null>(null);
  
  // Estados para o formulário inteligente
  const [userData, setUserData] = useState<any>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const creditCardFormRef = useRef<CreditCardFormRef>(null);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId) {
        showError("ID do produto não fornecido.");
        navigate("/");
        return;
      }

      setIsLoadingProduct(true);
      const { data: product, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .eq("status", "ativo")
        .single();

      if (productError || !product) {
        showError("Produto não encontrado ou não está disponível.");
        console.error("Error fetching product:", productError);
        navigate("/");
        return;
      }

      setMainProduct(product);

      if (product.orderbumps && product.orderbumps.length > 0) {
        const { data: bumps, error: bumpsError } = await supabase
          .from("products")
          .select("*")
          .in("id", product.orderbumps)
          .eq("status", "ativo");

        if (bumpsError) {
          console.error("Error fetching order bumps:", bumpsError);
        } else {
          setOrderBumps(bumps || []);
        }
      }

      setIsLoadingProduct(false);
    };

    fetchProductData();
  }, [productId, navigate]);

  useEffect(() => {
    if (mainProduct && userData && window.fbq) {
      trackInitiateCheckout(
        mainProduct.price,
        "BRL",
        [mainProduct.id],
        1,
        {
          email: userData.email,
          phone: userData.whatsapp,
          firstName: userData.name?.split(" ")[0],
          lastName: userData.name?.split(" ").slice(1).join(" "),
        }
      );
    }
  }, [mainProduct, userData]);

  const selectedOrderBumpsDetails = useMemo(() => {
    return orderBumps.filter((bump) => selectedOrderBumps.includes(bump.id));
  }, [orderBumps, selectedOrderBumps]);

  const originalTotalPrice = useMemo(() => {
    if (!mainProduct) return 0;
    const bumpsTotal = selectedOrderBumpsDetails.reduce((sum, bump) => sum + bump.price, 0);
    return mainProduct.price + bumpsTotal;
  }, [mainProduct, selectedOrderBumpsDetails]);

  const currentTotalPrice = useMemo(() => {
    let total = originalTotalPrice;
    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        total = total * (1 - appliedCoupon.value / 100);
      } else if (appliedCoupon.discount_type === "fixed") {
        total = Math.max(0, total - appliedCoupon.value);
      }
    }
    return total;
  }, [originalTotalPrice, appliedCoupon]);

  const handleOrderBumpToggle = (bumpId: string, isSelected: boolean) => {
    setSelectedOrderBumps((prev) =>
      isSelected ? [...prev, bumpId] : prev.filter((id) => id !== bumpId)
    );
  };

  const handleCouponApplied = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
  };

  const handleUserData = (data: any) => {
    setUserData(data);
    setShowPaymentForm(true);
  };

  const handleSubmit = async () => {
    if (!mainProduct || !userData) {
      showError("Dados incompletos. Por favor, preencha todas as informações.");
      return;
    }

    let creditCardData = null;
    if (paymentMethod === "CREDIT_CARD") {
      const creditCardFormValid = await creditCardFormRef.current?.submitForm();
      if (!creditCardFormValid) {
        showError("Por favor, preencha todos os campos do cartão de crédito.");
        return;
      }
      creditCardData = creditCardFormRef.current?.getValues();
    }

    setIsSubmitting(true);

    try {
      const productIds = [mainProduct.id, ...selectedOrderBumps];

      const payload: any = {
        name: userData.name,
        email: userData.email,
        cpf: userData.cpf.replace(/[^\d]+/g, ''), // Enviar CPF limpo
        whatsapp: userData.whatsapp.replace(/\D/g, ''), // Enviar WhatsApp limpo
        productIds,
        coupon_code: appliedCoupon?.code || null,
        paymentMethod,
        metaTrackingData: {
          ...metaTrackingData,
          event_source_url: window.location.href,
        },
        isNewUser: userData.isNewUser,
      };

      // Se for usuário existente, incluir o userId
      if (!userData.isNewUser && userData.userId) {
        payload.userId = userData.userId;
      }

      if (paymentMethod === "CREDIT_CARD" && creditCardData) {
        payload.creditCard = creditCardData;
      }

      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });

      if (error) {
        showError("Falha ao finalizar o checkout: " + error.message);
        console.error("Edge function error:", error);
        return;
      }

      if (paymentMethod === "PIX") {
        setPixDetails(data);
        setAsaasPaymentId(data.id);
        setOrderId(data.orderId);
        setIsPixModalOpen(true);
      } else if (paymentMethod === "CREDIT_CARD") {
        if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
          showSuccess("Pagamento confirmado!");
          navigate("/confirmacao", { state: { orderId: data.orderId, totalPrice: currentTotalPrice } });
        } else {
          showSuccess("Pedido criado! Aguardando confirmação do pagamento.");
          navigate("/processando-pagamento");
        }
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
      console.error("Checkout error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingProduct) {
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

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <CheckoutHeader backUrl={mainProduct.checkout_return_url || undefined} />

      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-2xl pb-32">
        <div className="space-y-6">
          <MainProductDisplayCard product={mainProduct} />

          {orderBumps.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-2xl font-bold text-gray-800">Aproveite também:</h2>
              {orderBumps.map((bump) => (
                <OrderBumpCard
                  key={bump.id}
                  product={bump}
                  isSelected={selectedOrderBumps.includes(bump.id)}
                  onToggle={handleOrderBumpToggle}
                />
              ))}
            </div>
          )}

          {!showPaymentForm ? (
            <SmartCheckoutForm
              onUserData={handleUserData}
              isLoading={isSubmitting}
            />
          ) : (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <div className="flex items-center gap-2 text-green-800">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="font-medium">Identificado como: {userData.name}</span>
                </div>
                <p className="text-sm text-green-700 mt-1">
                  E-mail: {userData.email}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowPaymentForm(false);
                    setUserData(null);
                  }}
                  className="mt-2"
                >
                  Usar outro e-mail
                </Button>
              </div>

              <CouponInputCard onCouponApplied={handleCouponApplied} />

              <OrderSummaryAccordion
                mainProduct={mainProduct}
                selectedOrderBumpsDetails={selectedOrderBumpsDetails}
                originalTotalPrice={originalTotalPrice}
                currentTotalPrice={currentTotalPrice}
                appliedCoupon={appliedCoupon}
              />

              <div className="bg-white rounded-xl shadow-lg p-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Dados de Pagamento</h2>
                
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">Método de Pagamento</h3>
                  <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "PIX" | "CREDIT_CARD")}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="PIX">PIX</TabsTrigger>
                      <TabsTrigger value="CREDIT_CARD">Cartão de Crédito</TabsTrigger>
                    </TabsList>
                    <TabsContent value="PIX" className="mt-4">
                      <p className="text-sm text-gray-600">
                        Você receberá um QR Code para pagamento via PIX após finalizar o pedido.
                      </p>
                    </TabsContent>
                    <TabsContent value="CREDIT_CARD" className="mt-4">
                      <CreditCardForm
                        ref={creditCardFormRef}
                        isLoading={isSubmitting}
                        totalPrice={currentTotalPrice}
                      />
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </>
          )}
        </div>
      </main>

      {showPaymentForm && (
        <FixedBottomBar
          totalPrice={currentTotalPrice}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      )}

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        orderId={orderId || ""}
        pixDetails={pixDetails}
        totalPrice={currentTotalPrice}
        asaasPaymentId={asaasPaymentId || ""}
      />
    </div>
  );
};

export default Checkout;
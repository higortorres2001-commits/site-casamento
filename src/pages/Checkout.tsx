"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon, Profile } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import OrderSummaryAccordion from "@/components/checkout/OrderSummaryAccordion";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
import CouponInputCard from "@/components/checkout/CouponInputCard";
import CheckoutForm, { CheckoutFormRef } from "@/components/checkout/CheckoutForm";
import CreditCardForm, { CreditCardFormRef } from "@/components/checkout/CreditCardForm";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import FixedBottomBar from "@/components/checkout/FixedBottomBar";
import MainProductDisplayCard from "@/components/checkout/MainProductDisplayCard";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSession } from "@/components/SessionContextProvider";
import WhatsAppButton from "@/components/WhatsAppButton";
import { useMetaTrackingData } from "@/hooks/use-meta-tracking-data";
import { trackInitiateCheckout } from "@/utils/metaPixel";

// Declare global interface for window.fbq
declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const metaTrackingData = useMetaTrackingData();

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTotalPrice, setCurrentTotalPrice] = useState(0);
  const [originalTotalPrice, setOriginalTotalPrice] = useState(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixDetails, setPixDetails] = useState<any>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>(null);

  const checkoutFormRef = useRef<CheckoutFormRef>(null);
  const creditCardFormRef = useRef<CreditCardFormRef>(null);

  // Track if InitiateCheckout has already been fired
  const hasTrackedInitiateCheckout = useRef(false);

  const fetchProductDetails = useCallback(async () => {
    if (!productId) {
      showError("ID do produto não fornecido.");
      navigate("/");
      return;
    }

    setIsLoading(true);
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      setIsLoading(false);
      console.error("Checkout DEBUG: Error fetching product details:", error);
      showError(
        `Produto não encontrado ou erro ao carregar: ${error?.message ?? "Desconhecido"}`
      );
      navigate("/");
      return;
    }

    setMainProduct(product);
    setSelectedOrderBumps([]);
    setOriginalTotalPrice(Number(product.price));
    setCurrentTotalPrice(Number(product.price));

    if (product.orderbumps && product.orderbumps.length > 0) {
      const { data: bumpsData, error: bumpsError } = await supabase
        .from("products")
        .select("*")
        .in("id", product.orderbumps);

      if (bumpsError) {
        console.error("Checkout DEBUG: Error fetching order bumps:", bumpsError);
        setOrderBumps([]);
      } else {
        setOrderBumps(bumpsData || []);
      }
    } else {
      setOrderBumps([]);
    }

    setIsLoading(false);
  }, [productId, navigate]);

  const fetchUserProfile = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, cpf, email, whatsapp, has_changed_password")
        .eq("id", user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
      } else if (data) {
        setUserProfile(data);
        if (data.has_changed_password === false) {
          navigate("/update-password");
        }
      }
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchProductDetails();
      fetchUserProfile();
    }
  }, [isSessionLoading, fetchProductDetails, fetchUserProfile]);

  useEffect(() => {
    if (mainProduct) {
      let newTotalPrice = Number(mainProduct.price);
      selectedOrderBumps.forEach((bumpId) => {
        const bump = orderBumps.find((b) => b.id === bumpId);
        if (bump) {
          newTotalPrice += Number(bump.price);
        }
      });

      setOriginalTotalPrice(newTotalPrice);

      if (appliedCoupon) {
        if (appliedCoupon.discount_type === "percentage") {
          newTotalPrice = newTotalPrice * (1 - appliedCoupon.value / 100);
        } else if (appliedCoupon.discount_type === "fixed") {
          newTotalPrice = Math.max(0, newTotalPrice - appliedCoupon.value);
        }
      }

      setCurrentTotalPrice(newTotalPrice);
    }
  }, [mainProduct, selectedOrderBumps, orderBumps, appliedCoupon]);

  useEffect(() => {
    if (
      !hasTrackedInitiateCheckout.current &&
      !isLoading &&
      mainProduct &&
      currentTotalPrice > 0 &&
      userProfile &&
      process.env.NODE_ENV === "production"
    ) {
      const productIds = [mainProduct.id, ...selectedOrderBumps];
      const numItems = productIds.length;
      const firstName = userProfile.name?.split(" ")[0] || null;
      const lastName = userProfile.name?.split(" ").slice(1).join(" ") || null;

      trackInitiateCheckout(currentTotalPrice, "BRL", productIds, numItems, {
        email: userProfile.email,
        phone: userProfile.whatsapp,
        firstName,
        lastName,
      });

      hasTrackedInitiateCheckout.current = true;
    }
  }, [isLoading, mainProduct, currentTotalPrice, selectedOrderBumps, userProfile]);

  const handleToggleOrderBump = (bumpId: string, isSelected: boolean) => {
    setSelectedOrderBumps((prev) =>
      isSelected ? [...prev, bumpId] : prev.filter((id) => id !== bumpId)
    );
  };

  const handleCouponApplied = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
    if (coupon) {
      showSuccess(`Cupom "${coupon.code}" aplicado!`);
    } else {
      showError("Cupom removido ou inválido.");
    }
  };

  const handleCheckout = async () => {
    if (!mainProduct) {
      showError("Nenhum produto principal selecionado.");
      return;
    }

    setIsSubmitting(true);
    let isFormValid = false;
    let checkoutFormData: any = {};
    let creditCardFormData: any = {};

    if (checkoutFormRef.current) {
      isFormValid = await checkoutFormRef.current.submitForm();
      if (isFormValid) {
        checkoutFormData = checkoutFormRef.current.getValues();
      }
    }

    if (!isFormValid) {
      showError("Por favor, preencha todos os dados pessoais corretamente.");
      setIsSubmitting(false);
      return;
    }

    if (paymentMethod === "CREDIT_CARD") {
      if (creditCardFormRef.current) {
        const isCreditCardFormValid = await creditCardFormRef.current.submitForm();
        if (isCreditCardFormValid) {
          creditCardFormData = creditCardFormRef.current.getValues();
        } else {
          showError("Por favor, preencha todos os dados do cartão corretamente.");
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      const productIdsToOrder = [mainProduct.id, ...selectedOrderBumps];
      const payload = {
        name: checkoutFormData.name,
        email: checkoutFormData.email,
        cpf: checkoutFormData.cpf,
        whatsapp: checkoutFormData.whatsapp,
        productIds: productIdsToOrder,
        coupon_code: appliedCoupon?.code || null,
        paymentMethod,
        creditCard: paymentMethod === "CREDIT_CARD" ? creditCardFormData : undefined,
        metaTrackingData: {
          ...metaTrackingData,
          event_source_url: window.location.href,
        },
      };

      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });

      if (error) {
        showError("Erro ao finalizar compra: " + error.message);
        console.error("Checkout error:", error);
        await supabase.from("logs").insert({
          level: "error",
          context: "client-checkout",
          message: `Failed to finalize checkout: ${error.message}`,
          metadata: { userId: user?.id, payload, error: error.message },
        });
      } else if (data) {
        showSuccess("Pedido criado com sucesso!");
        setAsaasPaymentId(data.id);
        if (paymentMethod === "PIX") {
          setPixDetails(data);
          setIsPixModalOpen(true);
        } else if (paymentMethod === "CREDIT_CARD") {
          navigate("/confirmacao", {
            state: { orderId: data.orderId, totalPrice: currentTotalPrice },
          });
        }
        await supabase.from("logs").insert({
          level: "info",
          context: "client-checkout",
          message: "Checkout successful, payment initiated.",
          metadata: { userId: user?.id, orderId: data.orderId, asaasPaymentId: data.id, paymentMethod },
        });
      }
    } catch (err: any) {
      showError("Erro inesperado ao finalizar compra: " + err.message);
      console.error("Unexpected checkout error:", err);
      await supabase.from("logs").insert({
        level: "error",
        context: "client-checkout",
        message: `Unhandled error during checkout: ${err.message}`,
        metadata: { userId: user?.id, errorStack: err.stack },
      });
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

  const selectedOrderBumpsDetails = orderBumps.filter((bump) =>
    selectedOrderBumps.includes(bump.id)
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <CheckoutHeader />
      <main className="flex-1 container mx-auto p-4 md:p-8 pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div className="space-y-6">
            <MainProductDisplayCard product={mainProduct} />

            {orderBumps.length > 0 && (
              <Card className="bg-white rounded-xl shadow-lg p-6 space-y-4">
                <CardTitle className="text-xl font-bold text-gray-800">
                  Adicione mais ao seu pedido!
                </CardTitle>
                {orderBumps.map((bump) => (
                  <OrderBumpCard
                    key={bump.id}
                    product={bump}
                    isSelected={selectedOrderBumps.includes(bump.id)}
                    onToggle={handleToggleOrderBump}
                  />
                ))}
              </Card>
            )}

            <CouponInputCard onCouponApplied={handleCouponApplied} />

            <OrderSummaryAccordion
              mainProduct={mainProduct}
              selectedOrderBumpsDetails={selectedOrderBumpsDetails}
              originalTotalPrice={originalTotalPrice}
              currentTotalPrice={currentTotalPrice}
              appliedCoupon={appliedCoupon}
            />
          </div>

          <div className="space-y-6">
            <Card className="bg-white rounded-xl shadow-lg p-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-800">Seus Dados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <CheckoutForm
                  ref={checkoutFormRef}
                  onSubmit={() => {}}
                  isLoading={isSubmitting}
                  initialData={userProfile || undefined}
                />
              </CardContent>
            </Card>

            <Card className="bg-white rounded-xl shadow-lg p-6">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold text-gray-800">Método de Pagamento</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <RadioGroup
                  value={paymentMethod}
                  onValueChange={(value: "PIX" | "CREDIT_CARD") => setPaymentMethod(value)}
                  className="grid grid-cols-1 gap-4"
                >
                  <div className="flex items-center space-x-2 p-4 border rounded-md cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:ring-2 has-[:checked]:ring-orange-500">
                    <RadioGroupItem value="PIX" id="pix" className="text-orange-500" />
                    <Label htmlFor="pix" className="flex-1 cursor-pointer text-base font-medium">
                      PIX
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 p-4 border rounded-md cursor-pointer has-[:checked]:border-orange-500 has-[:checked]:ring-2 has-[:checked]:ring-orange-500">
                    <RadioGroupItem value="CREDIT_CARD" id="credit-card" className="text-orange-500" />
                    <Label
                      htmlFor="credit-card"
                      className="flex-1 cursor-pointer text-base font-medium"
                    >
                      Cartão de Crédito
                    </Label>
                  </div>
                </RadioGroup>

                {paymentMethod === "CREDIT_CARD" && (
                  <div className="mt-6">
                    <CreditCardForm ref={creditCardFormRef} isLoading={isSubmitting} />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <FixedBottomBar
        totalPrice={currentTotalPrice}
        isSubmitting={isSubmitting}
        onSubmit={handleCheckout}
      />

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        orderId={pixDetails?.orderId || ""}
        pixDetails={pixDetails}
        totalPrice={currentTotalPrice}
        asaasPaymentId={asaasPaymentId || ""}
      />

      <WhatsAppButton />
    </div>
  );
};

export default Checkout;
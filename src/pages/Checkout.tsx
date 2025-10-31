"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams } from "react-router-dom";
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
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

type InstallmentOption = {
  quantity: number;
  installmentValue: number;
  total?: number;
};

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const { user, isLoading: isSessionLoading } = useSession();
  const metaTrackingData = useMetaTrackingData();
  const isMobile = useIsMobile();

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [finalPrice, setFinalPrice] = useState<number>(0);
  const [currentTotalPrice, setCurrentTotalPrice] = useState<number>(0);
  const [baseTotalPrice, setBaseTotalPrice] = useState<number>(0);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixDetails, setPixDetails] = useState<any>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>(null);

  const [installmentOptions, setInstallmentOptions] = useState<InstallmentOption[]>([]);
  const [installmentsLoading, setInstallmentsLoading] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState<string>("1");
  const installmentsDebounceRef = useRef<number | null>(null);

  const checkoutFormRef = useRef<CheckoutFormRef>(null);
  const creditCardFormRef = useRef<CreditCardFormRef>(null);

  const hasTrackedInitiateCheckout = useRef(false);

  const normalizeProduct = (p: any): Product => ({
    ...p,
    price: Number(p.price),
  });

  const fetchProductDetails = useCallback(async () => {
    if (!productId) {
      showError("ID do produto não fornecido.");
      setIsLoading(false);
      setMainProduct(null);
      return;
    }

    setIsLoading(true);
    const { data: product, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", productId)
      .single();

    if (error || !product) {
      console.error("Checkout DEBUG: Error fetching product details:", error);
      showError("Produto indisponível para compra no momento.");
      setMainProduct(null);
      setOrderBumps([]);
      setFinalPrice(0);
      setCurrentTotalPrice(0);
      setBaseTotalPrice(0);
      setIsLoading(false);
      return;
    }

    const normalizedMain = normalizeProduct(product);
    setMainProduct(normalizedMain);
    setSelectedOrderBumps([]);
    setBaseTotalPrice(Number(normalizedMain.price));
    setFinalPrice(Number(normalizedMain.price));
    setCurrentTotalPrice(Number(normalizedMain.price));

    if (product.orderbumps && product.orderbumps.length > 0) {
      const { data: bumpsData, error: bumpsError } = await supabase
        .from("products")
        .select("*")
        .in("id", product.orderbumps);

      if (bumpsError) {
        console.error("Checkout DEBUG: Error fetching order bumps:", bumpsError);
        setOrderBumps([]);
      } else {
        setOrderBumps((bumpsData || []).map(normalizeProduct) as Product[]);
      }
    } else {
      setOrderBumps([]);
    }

    setIsLoading(false);
  }, [productId]);

  const fetchUserProfile = useCallback(async () => {
    if (user) {
      const { data, error } = await supabase
        .from("profiles")
        .select("name, cpf, email, whatsapp, has_changed_password")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setUserProfile(data);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchProductDetails();
      fetchUserProfile();
    }
  }, [isSessionLoading, fetchProductDetails, fetchUserProfile]);

  useEffect(() => {
    if (!mainProduct) return;

    let calculated = Number(mainProduct.price);
    selectedOrderBumps.forEach((id) => {
      const bump = orderBumps.find((b) => b.id === id);
      if (bump) calculated += Number(bump.price);
    });

    if (appliedCoupon) {
      if (appliedCoupon.discount_type === "percentage") {
        calculated = calculated * (1 - Number(appliedCoupon.value) / 100);
      } else if (appliedCoupon.discount_type === "fixed") {
        calculated = Math.max(0, calculated - Number(appliedCoupon.value));
      }
    }

    setBaseTotalPrice(
      Number(mainProduct.price) +
        orderBumps
          .filter((b) => selectedOrderBumps.includes(b.id))
          .reduce((acc, b) => acc + Number(b.price), 0)
    );
    setFinalPrice(calculated);
    setCurrentTotalPrice(calculated);
  }, [mainProduct, orderBumps, selectedOrderBumps, appliedCoupon, isSessionLoading]);

  useEffect(() => {
    if (paymentMethod !== "CREDIT_CARD") {
      setInstallmentOptions([]);
      setSelectedInstallment("1");
      return;
    }

    if (!finalPrice || finalPrice <= 0) {
      setInstallmentOptions([]);
      setSelectedInstallment("1");
      return;
    }

    if (installmentsDebounceRef.current) {
      clearTimeout(installmentsDebounceRef.current);
    }
    setInstallmentsLoading(true);

    installmentsDebounceRef.current = window.setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("calculate-installments", {
          body: { value: finalPrice },
        });

        if (error) {
          console.error("Installments simulation error:", error);
          setInstallmentOptions([]);
          setSelectedInstallment("1");
        } else {
          const parsed = parseInstallmentsResponse(data);
          setInstallmentOptions(parsed);
          const exists = parsed.find((o) => String(o.quantity) === String(selectedInstallment));
          if (!exists && parsed.length > 0) {
            setSelectedInstallment(String(parsed[0].quantity));
          }
        }
      } catch (e) {
        console.error("Installments simulation unexpected error:", e);
        setInstallmentOptions([]);
        setSelectedInstallment("1");
      } finally {
        setInstallmentsLoading(false);
      }
    }, 350) as unknown as number;

    return () => {
      if (installmentsDebounceRef.current) {
        clearTimeout(installmentsDebounceRef.current);
        installmentsDebounceRef.current = null;
      }
    };
  }, [finalPrice, paymentMethod, selectedInstallment]);

  function parseInstallmentsResponse(resp: any): InstallmentOption[] {
    const raw =
      resp?.installments ||
      resp?.data ||
      resp?.installmentOptions ||
      resp?.items ||
      (Array.isArray(resp) ? resp : []);

    if (!Array.isArray(raw)) return [];

    return raw
      .map((it: any) => {
        const quantity = Number(
          it.installmentCount ?? it.quantity ?? it.number ?? it.installments ?? 1
        );
        const installmentValue = Number(
          it.installmentValue ?? it.value ?? it.amount ?? it.valor ?? 0
        );
        const total = Number(
          it.totalValueWithInterest ??
            it.totalValue ??
            it.total ??
            installmentValue * quantity
        );
        return { quantity, installmentValue, total };
      })
      .filter((x) => x.quantity > 0 && x.installmentValue > 0)
      .sort((a, b) => a.quantity - b.quantity);
  }

  useEffect(() => {
    if (
      !hasTrackedInitiateCheckout.current &&
      !isLoading &&
      mainProduct &&
      finalPrice > 0 &&
      userProfile &&
      process.env.NODE_ENV === "production"
    ) {
      const productIds = [mainProduct.id, ...selectedOrderBumps];
      const numItems = productIds.length;
      const firstName = userProfile.name?.split(" ")[0] || null;
      const lastName = userProfile.name?.split(" ").slice(1).join(" ") || null;

      trackInitiateCheckout(finalPrice, "BRL", productIds, numItems, {
        email: userProfile.email,
        phone: userProfile.whatsapp,
        firstName,
        lastName,
      });

      hasTrackedInitiateCheckout.current = true;
    }
  }, [isLoading, finalPrice, mainProduct, selectedOrderBumps, userProfile]);

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
        totalPaymentValue: finalPrice,
        installmentCount:
          paymentMethod === "CREDIT_CARD" ? Number(selectedInstallment || "1") : undefined,
        selectedBumpIds: selectedOrderBumps,
        appliedCouponCode: appliedCoupon?.code || null,
      };

      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });

      if (error) {
        showError("Erro ao finalizar compra: " + error.message);
        console.error("Checkout error:", error);
      } else if (data) {
        showSuccess("Pedido criado com sucesso!");
        setAsaasPaymentId(data.id);
        if (paymentMethod === "PIX") {
          setPixDetails(data);
          setIsPixModalOpen(true);
        } else if (paymentMethod === "CREDIT_CARD") {
          window.location.href = "/confirmacao";
        }
      }
    } catch (err: any) {
      showError("Erro inesperado ao finalizar compra: " + err.message);
      console.error("Unexpected checkout error:", err);
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
      <div className="flex flex-col min-h-screen bg-gray-100">
        <CheckoutHeader />
        <main className="flex-1 container mx-auto p-4 md:p-8">
          <Card className="bg-white rounded-xl shadow-lg max-w-2xl mx-auto p-6 text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold text-gray-800">
                Produto indisponível
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-700">
              <p>
                Este link de checkout não está disponível no momento. Verifique se o produto está
                ativo ou tente novamente mais tarde.
              </p>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const selectedOrderBumpsDetails = orderBumps.filter((bump) =>
    selectedOrderBumps.includes(bump.id)
  );

  const backUrl = !user && mainProduct.checkout_return_url ? mainProduct.checkout_return_url : undefined;

  const activeInstallment = useMemo(
    () => installmentOptions.find((o) => String(o.quantity) === String(selectedInstallment)),
    [installmentOptions, selectedInstallment]
  );

  const customerDataSection = (
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
  );

  const productInfoSection = <MainProductDisplayCard product={mainProduct} />;

  const orderBumpsSection = orderBumps.length > 0 ? (
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
  ) : null;

  const couponSection = <CouponInputCard onCouponApplied={handleCouponApplied} />;

  const paymentSection = (
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
          <div className="mt-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parcelamento
              </label>
              <Select
                value={selectedInstallment}
                onValueChange={setSelectedInstallment}
                disabled={installmentsLoading || installmentOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={installmentsLoading ? "Calculando..." : "Selecione as parcelas"}
                  >
                    {activeInstallment
                      ? `${activeInstallment.quantity}x de R$ ${activeInstallment.installmentValue.toFixed(
                          2
                        )} (total R$ ${(
                          activeInstallment.total ??
                          activeInstallment.installmentValue * activeInstallment.quantity
                        ).toFixed(2)})`
                      : undefined}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {installmentOptions.map((opt) => {
                    const total = opt.total ?? opt.installmentValue * opt.quantity;
                    return (
                      <SelectItem key={opt.quantity} value={String(opt.quantity)}>
                        {opt.quantity}x de R$ {opt.installmentValue.toFixed(2)} (total R$ {total.toFixed(2)})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {installmentsLoading && (
                <p className="mt-1 text-xs text-gray-500">Calculando parcelas...</p>
              )}
              {!installmentsLoading && installmentOptions.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  Baseado no total do pedido: R$ {finalPrice.toFixed(2)}
                </p>
              )}
            </div>

            <CreditCardForm ref={creditCardFormRef} isLoading={isSubmitting} />
          </div>
        )}
      </CardContent>
    </Card>
  );

  const orderSummarySection = (
    <OrderSummaryAccordion
      mainProduct={mainProduct}
      selectedOrderBumpsDetails={selectedOrderBumpsDetails}
      originalTotalPrice={baseTotalPrice}
      currentTotalPrice={currentTotalPrice}
      appliedCoupon={appliedCoupon}
    />
  );

  const contentPaddingBottomClass = isMobile ? "pb-48" : "pb-24";

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <CheckoutHeader backUrl={backUrl} />
      <main className={`flex-1 container mx-auto p-4 md:p-8 ${contentPaddingBottomClass}`}>
        {isMobile ? (
          <div className="max-w-3xl mx-auto space-y-6">
            {productInfoSection}
            {customerDataSection}
            {paymentSection}
            {orderBumpsSection}
            {couponSection}
            {orderSummarySection}
            <div className="text-xs text-gray-600 mt-6 px-1 leading-relaxed">
              <p>ACESSO IMEDIATO</p>
              <p>GARANTIA DE 7 DIAS</p>
              <p>PAGAMENTO PROCESSADO POR ESCRITORIO CHEIO CNPJ N 44.962.282/0001-83 HIGOR R T S</p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {customerDataSection}
            {productInfoSection}
            {orderBumpsSection}
            {couponSection}
            {paymentSection}
            <div className="space-y-4">
              {orderSummarySection}
              <Button
                type="button"
                onClick={handleCheckout}
                disabled={isSubmitting}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-md py-3 text-lg"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Finalizar Compra Agora"}
              </Button>
            </div>
          </div>
        )}
      </main>

      {isMobile && (
        <FixedBottomBar
          totalPrice={finalPrice}
          isSubmitting={isSubmitting}
          onSubmit={handleCheckout}
        />
      )}

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        orderId={pixDetails?.orderId || ""}
        pixDetails={pixDetails}
        totalPrice={finalPrice}
        asaasPaymentId={asaasPaymentId || ""}
      />

      <WhatsAppButton />
    </div>
  );
};

export default Checkout;
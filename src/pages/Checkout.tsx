"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import ProductCard from "@/components/checkout/ProductCard";
import CustomerDataCard from "@/components/checkout/CustomerDataCard";
import PaymentMethodCard from "@/components/checkout/PaymentMethodCard";
import OrderBumpsCard from "@/components/checkout/OrderBumpsCard";
import OrderSummaryCard from "@/components/checkout/OrderSummaryCard";
import PostPurchaseInfoCard from "@/components/checkout/PostPurchaseInfoCard";
import FixedBottomBar from "@/components/checkout/FixedBottomBar";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import { CheckoutFormRef } from "@/components/checkout/CheckoutForm";
import { CreditCardFormRef } from "@/components/checkout/CreditCardForm";
import { useSession } from "@/components/SessionContextProvider";
import { useMetaTrackingData } from "@/hooks/use-meta-tracking-data";
import { trackInitiateCheckout } from "@/utils/metaPixel";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

// Função para extrair primeiro e último nome
const extractNameParts = (fullName: string | null | undefined): { firstName: string | null; lastName: string | null } => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: null, lastName: null };
  }
  
  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length === 0) {
    return { firstName: null, lastName: null };
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;  
  return { firstName, lastName };
};

// Função para limpar WhatsApp (remover formatação)
const cleanWhatsApp = (whatsapp: string | null | undefined): string | null => {
  if (!whatsapp) return null;
  return whatsapp.replace(/\D/g, ''); // Remove tudo que não é dígito
};

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const metaTrackingData = useMetaTrackingData();

  // Estados principais
  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [isLoadingProduct, setIsLoadingProduct] = useState(true);

  // Estados do modal PIX
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixDetails, setPixDetails] = useState<any>(null);
  const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);

  // Refs para formulários
  const checkoutFormRef = useRef<CheckoutFormRef>(null);
  const creditCardFormRef = useRef<CreditCardFormRef>(null);

  // Carregar dados do produto
  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId) {
        showError("ID do produto não fornecido.");
        navigate("/");
        return;
      }

      setIsLoadingProduct(true);
      
      try {
        // Buscar produto principal
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

        // Buscar order bumps se existirem
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
        } else {
          setOrderBumps([]);
        }
        
      } catch (error: any) {
        console.error("Unexpected error in fetchProductData:", error);
        showError("Erro ao carregar dados do produto.");
        navigate("/");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProductData();
  }, [productId, navigate]);

  // Tracking do Meta Pixel
  useEffect(() => {
    if (mainProduct && window.fbq) {
      let customerData = {
        email: user?.email || null,
        phone: user?.user_metadata?.whatsapp ? cleanWhatsApp(user.user_metadata.whatsapp) : null,
        firstName: user?.user_metadata?.name ? extractNameParts(user.user_metadata.name).firstName : null,
        lastName: user?.user_metadata?.name ? extractNameParts(user.user_metadata.name).lastName : null,
      };

      if (!user) {
        customerData = {
          email: null,
          phone: null,
          firstName: null,
          lastName: null,
        };
      }

      trackInitiateCheckout(
        mainProduct.price,
        "BRL",
        [mainProduct.id],
        1,
        customerData
      );
    }
  }, [mainProduct, user]);

  // Cálculos de preço
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

  // Handlers
  const handleOrderBumpToggle = (bumpId: string, isSelected: boolean) => {
    setSelectedOrderBumps((prev) =>
      isSelected ? [...prev, bumpId] : prev.filter((id) => id !== bumpId)
    );
  };

  const handleCouponApplied = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
  };

  const handleSubmit = async () => {
    if (!mainProduct) {
      showError("Produto não carregado.");
      return;
    }

    const checkoutFormValid = await checkoutFormRef.current?.submitForm();
    if (!checkoutFormValid) {
      showError("Por favor, preencha todos os campos obrigatórios do formulário.");
      return;
    }

    const checkoutFormData = checkoutFormRef.current?.getValues();
    if (!checkoutFormData) {
      showError("Erro ao obter dados do formulário.");
      return;
    }

    // Extrair dados do formulário para Meta Pixel
    const formDataCustomerData = {
      email: checkoutFormData.email,
      phone: cleanWhatsApp(checkoutFormData.whatsapp),
      firstName: extractNameParts(checkoutFormData.name).firstName,
      lastName: extractNameParts(checkoutFormData.name).lastName,
    };

    // Disparar evento InitiateCheckout com dados do formulário
    if (window.fbq) {
      trackInitiateCheckout(
        currentTotalPrice,
        "BRL",
        [mainProduct.id, ...selectedOrderBumps],
        1 + selectedOrderBumps.length,
        formDataCustomerData
      );
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
        name: checkoutFormData.name,
        email: checkoutFormData.email,
        cpf: checkoutFormData.cpf,
        whatsapp: checkoutFormData.whatsapp,
        productIds,
        coupon_code: appliedCoupon?.code || null,
        paymentMethod,
        metaTrackingData: {
          ...metaTrackingData,
          event_source_url: window.location.href,
        },
      };

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

  // Detectar se é mobile
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex flex-col">
      <CheckoutHeader backUrl={mainProduct.checkout_return_url || undefined} />

      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-4xl pb-32">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Coluna Principal - Cards em ordem */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1. Card do Produto */}
            <ProductCard product={mainProduct} />

            {/* 2. Dados do Cliente */}
            <CustomerDataCard ref={checkoutFormRef} isLoading={isSubmitting} />

            {/* 3. Método de Pagamento */}
            <PaymentMethodCard
              ref={creditCardFormRef}
              paymentMethod={paymentMethod}
              onPaymentMethodChange={setPaymentMethod}
              isLoading={isSubmitting}
              totalPrice={currentTotalPrice}
            />

            {/* 4. Order Bumps */}
            <OrderBumpsCard
              orderBumps={orderBumps}
              selectedOrderBumps={selectedOrderBumps}
              onOrderBumpToggle={handleOrderBumpToggle}
            />

            {/* 5. Resumo do Pedido (mobile) */}
            {isMobile && (
              <OrderSummaryCard
                mainProduct={mainProduct}
                selectedOrderBumpsDetails={selectedOrderBumpsDetails}
                originalTotalPrice={originalTotalPrice}
                currentTotalPrice={currentTotalPrice}
                appliedCoupon={appliedCoupon}
                onCouponApplied={handleCouponApplied}
              />
            )}

            {/* 6. Box Informativo Pós-Compra */}
            <PostPurchaseInfoCard />
          </div>

          {/* Coluna Lateral - Resumo do Pedido (desktop) */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              {!isMobile && (
                <OrderSummaryCard
                  mainProduct={mainProduct}
                  selectedOrderBumpsDetails={selectedOrderBumpsDetails}
                  originalTotalPrice={originalTotalPrice}
                  currentTotalPrice={currentTotalPrice}
                  appliedCoupon={appliedCoupon}
                  onCouponApplied={handleCouponApplied}
                />
              )}

              {/* Botão de Finalizar para Desktop */}
              {!isMobile && (
                <div className="mt-6">
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white py-4 text-lg font-semibold shadow-lg rounded-lg transition-all duration-200 transform hover:scale-105"
                    size="lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <span className="text-xl mr-2">🚀</span>
                        Finalizar Compra Agora
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-gray-500 text-center mt-2">
                    Pagamento 100% seguro e protegido
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Barra fixa apenas para mobile */}
      {isMobile && (
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
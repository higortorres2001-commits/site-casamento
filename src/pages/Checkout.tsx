"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import MainProductDisplayCard from "@/components/checkout/MainProductDisplayCard";
import CheckoutForm, { CheckoutFormRef } from "@/components/checkout/CheckoutForm";
import CreditCardForm, { CreditCardFormRef } from "@/components/checkout/CreditCardForm";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
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

  const checkoutFormRef = useRef<CheckoutFormRef>(null);
  const creditCardFormRef = useRef<CreditCardFormRef>(null);

  useEffect(() => {
    const fetchProductData = async () => {
      if (!productId) {
        showError("ID do produto não fornecido.");
        navigate("/");
        return;
      }

      setIsLoadingProduct(true);
      
      try {
        console.log("🔍 Fetching product data for:", productId);
        
        // Executar ambas as consultas em paralelo com Promise.all
        const [productResult, bumpsResult] = await Promise.all([
          // Consulta 1: Buscar o produto principal
          supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .eq("status", "ativo")
            .single(),
          
          // Consulta 2: Buscar os order bumps (se existirem)
          supabase
            .from("products")
            .select("id, name, price")
            .eq("status", "ativo")
            .in("id", [productId]) // Placeholder, será atualizado abaixo
        ]);
        
        const { data: product, error: productError } = productResult;
        
        if (productError || !product) {
          console.error("❌ Error fetching product:", productError);
          showError("Produto não encontrado ou não está disponível.");
          navigate("/");
          return;
        }

        console.log("✅ Product found:", product);
        
        // Configurar o produto principal imediatamente
        setMainProduct(product);

        // Buscar os order bumps em paralelo (se existirem)
        if (product.orderbumps && product.orderbumps.length > 0) {
          console.log("🔍 Fetching order bumps:", product.orderbumps);
          
          const { data: bumps, error: bumpsError } = await supabase
            .from("products")
            .select("*")
            .in("id", product.orderbumps)
            .eq("status", "ativo");

          if (bumpsError) {
            console.error("❌ Error fetching order bumps:", bumpsError);
          } else {
            console.log("✅ Order bumps found:", bumps);
            setOrderBumps(bumps || []);
          }
        } else {
          console.log("ℹ️ No order bumps for this product");
          setOrderBumps([]);
        }
        
      } catch (error: any) {
        console.error("❌ Unexpected error in fetchProductData:", error);
        showError("Erro ao carregar dados do produto.");
        navigate("/");
      } finally {
        setIsLoadingProduct(false);
      }
    };

    fetchProductData();
  }, [productId, navigate]);

  useEffect(() => {
    if (mainProduct && window.fbq) {
      // Extrair dados do usuário logado
      let customerData = {
        email: user?.email || null,
        phone: user?.user_metadata?.whatsapp ? cleanWhatsApp(user.user_metadata.whatsapp) : null,
        firstName: user?.user_metadata?.name ? extractNameParts(user.user_metadata.name).firstName : null,
        lastName: user?.user_metadata?.name ? extractNameParts(user.user_metadata.name).lastName : null,
      };

      // Se não há usuário logado, usar dados vazios
      if (!user) {
        customerData = {
          email: null,
          phone: null,
          firstName: null,
          lastName: null,
        };
      }

      console.log("📊 Tracking checkout with data:", customerData);

      trackInitiateCheckout(
        mainProduct.price,
        "BRL",
        [mainProduct.id],
        1,
        customerData
      );
    }
  }, [mainProduct, user]);

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
    console.log("🎯 Cupom recebido no Checkout:", coupon);
    setAppliedCoupon(coupon);
  };

  const handleSubmit = async () => {
    if (!mainProduct) {
      showError("Produto não carregado.");
      return;
    }

    console.log("🚀 Starting checkout process...");

    const checkoutFormValid = await checkoutFormRef.current?.submitForm();
    if (!checkoutFormValid) {
      console.error("❌ Checkout form validation failed");
      showError("Por favor, preencha todos os campos obrigatórios do formulário.");
      return;
    }

    const checkoutFormData = checkoutFormRef.current?.getValues();
    if (!checkoutFormData) {
      console.error("❌ Could not get checkout form data");
      showError("Erro ao obter dados do formulário.");
      return;
    }

    console.log("📝 Checkout form data:", checkoutFormData);

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
      console.log("💳 Validating credit card form...");
      const creditCardFormValid = await creditCardFormRef.current?.submitForm();
      if (!creditCardFormValid) {
        console.error("❌ Credit card form validation failed");
        showError("Por favor, preencha todos os campos do cartão de crédito.");
        return;
      }
      creditCardData = creditCardFormRef.current?.getValues();
      console.log("💳 Credit card data:", creditCardData);
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

      console.log("📤 Sending payment payload:", {
        ...payload,
        coupon_code: appliedCoupon?.code || null,
        coupon_applied: !!appliedCoupon,
        coupon_value: appliedCoupon?.value,
        coupon_type: appliedCoupon?.discount_type,
        original_total: originalTotalPrice,
        final_total: currentTotalPrice
      });

      console.log("🌐 Calling create-asaas-payment function...");

      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });

      if (error) {
        console.error("❌ Edge function error:", error);
        showError("Falha ao processar pagamento: " + error.message);
        return;
      }

      console.log("✅ Payment function response:", data);

      if (paymentMethod === "PIX") {
        console.log("📱 Setting up PIX modal...");
        setPixDetails(data);
        setAsaasPaymentId(data.id);
        setOrderId(data.orderId);
        setIsPixModalOpen(true);
      } else if (paymentMethod === "CREDIT_CARD") {
        console.log("💳 Processing credit card response...");
        if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
          console.log("✅ Credit card payment confirmed");
          showSuccess("Pagamento confirmado!");
          navigate("/confirmacao", { state: { orderId: data.orderId, totalPrice: currentTotalPrice } });
        } else {
          console.log("⏳ Credit card payment pending");
          showSuccess("Pedido criado! Aguardando confirmação do pagamento.");
          navigate("/processando-pagamento");
        }
      }
    } catch (err: any) {
      console.error("❌ Unexpected error in handleSubmit:", err);
      showError("Erro inesperado: " + err.message);
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

          <OrderSummaryAccordion
            mainProduct={mainProduct}
            selectedOrderBumpsDetails={selectedOrderBumpsDetails}
            originalTotalPrice={originalTotalPrice}
            currentTotalPrice={currentTotalPrice}
            appliedCoupon={appliedCoupon}
            onCouponApplied={handleCouponApplied}
          />

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Informações do Comprador</h2>
            <CheckoutForm
              ref={checkoutFormRef}
              onSubmit={() => {}}
              isLoading={isSubmitting}
            />

            <div className="mt-6">
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
        </div>
      </main>

      <FixedBottomBar
        totalPrice={currentTotalPrice}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />

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
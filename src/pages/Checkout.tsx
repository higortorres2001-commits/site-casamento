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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Package, Truck, CheckCircle, MessageCircle } from "lucide-react";

declare global {
  interface Window {
    fbq: (...args: any[]) => void;
  }
}

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

const cleanWhatsApp = (whatsapp: string | null | undefined): string | null => {
  if (!whatsapp) return null;
  return whatsapp.replace(/\D/g, '');
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

  // Estados para controle do InitiateCheckout
  const [hasTriggeredInitialCheckout, setHasTriggeredInitialCheckout] = useState(false);
  const [hasTriggeredFormCheckout, setHasTriggeredFormCheckout] = useState(false);

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
        const [productResult, bumpsResult] = await Promise.all([
          supabase
            .from("products")
            .select("*")
            .eq("id", productId)
            .eq("status", "ativo")
            .single(),
          
          supabase
            .from("products")
            .select("id, name, price")
            .eq("status", "ativo")
            .in("id", [productId])
        ]);
        
        const { data: product, error: productError } = productResult;
        
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

  // 🎯 InitiateCheckout inicial - quando o produto carrega (sem dados do usuário)
  useEffect(() => {
    if (mainProduct && window.fbq && !hasTriggeredInitialCheckout) {
      console.log("🎯 Triggering initial InitiateCheckout (page load)");
      
      // Dados básicos sem informações do usuário
      const basicCustomerData = {
        email: null,
        phone: null,
        firstName: null,
        lastName: null,
      };

      trackInitiateCheckout(
        mainProduct.price,
        "BRL",
        [mainProduct.id],
        1,
        basicCustomerData
      );

      setHasTriggeredInitialCheckout(true);
    }
  }, [mainProduct, hasTriggeredInitialCheckout]);

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

  // 🎯 Função para disparar InitiateCheckout com dados do formulário
  const triggerFormInitiateCheckout = (formData: any) => {
    if (!mainProduct || !window.fbq || hasTriggeredFormCheckout) return;

    console.log("🎯 Triggering InitiateCheckout with form data");

    const formDataCustomerData = {
      email: formData.email,
      phone: cleanWhatsApp(formData.whatsapp),
      firstName: extractNameParts(formData.name).firstName,
      lastName: extractNameParts(formData.name).lastName,
    };

    trackInitiateCheckout(
      currentTotalPrice,
      "BRL",
      [mainProduct.id, ...selectedOrderBumps],
      1 + selectedOrderBumps.length,
      formDataCustomerData
    );

    setHasTriggeredFormCheckout(true);
  };

  const handleSubmit = async () => {
    if (!mainProduct) {
      showError("Produto não carregado.");
      return;
    }

    const checkoutFormValid = await checkoutFormRef.current?.submitForm();
    if (!checkoutFormValid) {
      showError("Por favor, preencha todos os campos obrigatórios.");
      return;
    }

    const checkoutFormData = checkoutFormRef.current?.getValues();
    if (!checkoutFormData) {
      showError("Erro ao obter dados do formulário.");
      return;
    }

    // 🎯 Disparar InitiateCheckout com dados do formulário preenchido
    triggerFormInitiateCheckout(checkoutFormData);

    let creditCardData = null;
    if (paymentMethod === "CREDIT_CARD") {
      const creditCardFormValid = await creditCardFormRef.current?.submitForm();
      if (!creditCardFormValid) {
        showError("Por favor, preencha todos os campos do cartão.");
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
        // Verificar se é erro recuperável
        if (error.message?.includes('recuperável') || error.message?.includes('temporário')) {
          showError("Erro temporário. Seus dados foram salvos e entraremos em contato em breve.");
        } else {
          showError("Erro ao processar pagamento: " + error.message);
        }
        console.error("Payment error:", error);
        return;
      }

      if (data?.error) {
        showError(data.error);
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
          showSuccess("Pedido criado! Aguardando confirmação.");
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

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Informações do Comprador</h2>
            <CheckoutForm
              ref={checkoutFormRef}
              onSubmit={() => {}}
              isLoading={isSubmitting}
            />
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
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

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="delivery-info" className="border-none">
              <div className="bg-blue-50 rounded-xl shadow-md">
                <AccordionTrigger className="flex justify-between items-center p-4 text-lg font-semibold text-blue-800 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    <span>Como funciona a entrega do material?</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="p-4 border-t border-blue-200 bg-white rounded-b-xl">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-gray-800">Confirmação do Pagamento</h4>
                        <p className="text-sm text-gray-600">Após a confirmação do seu pagamento, você receberá um e-mail com suas credenciais de acesso.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Truck className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-gray-800">Acesso Imediato</h4>
                        <p className="text-sm text-gray-600">Não há entrega física. Todo o material é digital e fica disponível na sua área de membros para download.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MessageCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-semibold text-gray-800">Suporte Disponível</h4>
                        <p className="text-sm text-gray-600">Em caso de dúvidas ou dificuldades no acesso, clique no botão do WhatsApp para falar conosco.</p>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </div>
            </AccordionItem>
          </Accordion>

          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              O pagamento será processado para <strong>CNPJ: 44.962.282/0001-83</strong>. 
              Em caso de qualquer dúvida ou dificuldade no acesso aos materiais, 
              clique no botão do WhatsApp para entrar em contato conosco. 
              Estamos aqui para ajudar!
            </p>
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
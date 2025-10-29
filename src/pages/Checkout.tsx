"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon, Profile } from "@/types";
import { useSession } from "@/components/SessionContextProvider";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import CheckoutHeader from "@/components/checkout/CheckoutHeader";
import OrderSummaryAccordion from "@/components/checkout/OrderSummaryAccordion";
import OrderBumpCard from "@/components/checkout/OrderBumpCard";
import CouponInputCard from "@/components/checkout/CouponInputCard";
import CheckoutForm, { CheckoutFormRef } from "@/components/checkout/CheckoutForm";
import CreditCardForm, { CreditCardFormRef } from "@/components/checkout/CreditCardForm"; // Import CreditCardForm and its ref
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import FixedBottomBar from "@/components/checkout/FixedBottomBar";
import MainProductDisplayCard from "@/components/checkout/MainProductDisplayCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimeChannel } from '@supabase/supabase-js'; // Import RealtimeChannel
import { useMetaTrackingData } from "@/hooks/use-meta-tracking-data"; // Import the new hook
import { trackInitiateCheckout } from "@/utils/metaPixel"; // Import trackInitiateCheckout

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();
  const metaTrackingData = useMetaTrackingData(); // Use the new hook

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [originalTotalPrice, setOriginalTotalPrice] = useState(0);
  const [currentTotalPrice, setCurrentTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");

  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [modalPixDetails, setModalPixDetails] = useState<any>(null); // This will now receive the flat object
  const [modalTotalPrice, setModalTotalPrice] = useState<number>(0);
  const [modalOrderId, setModalOrderId] = useState<string>("");
  const [modalAsaasPaymentId, setModalAsaasPaymentId] = useState<string>(""); // New state for Asaas Payment ID

  const checkoutFormRef = useRef<CheckoutFormRef>(null);
  const creditCardFormRef = useRef<CreditCardFormRef>(null); // Ref for credit card form

  // Ref para garantir que o evento InitiateCheckout seja rastreado apenas uma vez
  const hasTrackedInitiateCheckout = useRef(false);

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

    if (productError) {
      console.error("Supabase error fetching main product:", productError); // Log de erro mais específico
      showError("Produto não encontrado ou erro ao carregar: " + productError.message);
      navigate("/");
      return;
    }
    if (!productData) {
      console.error("No product data found for ID:", productId); // Log para quando não há dados
      showError("Produto não encontrado ou erro ao carregar.");
      navigate("/");
      return;
    }
    setMainProduct(productData);

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
        .select('name, cpf, email, whatsapp')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error("Error fetching user profile:", error);
        setUserProfile(null);
      } else if (data) {
        setUserProfile({
          name: data.name || '',
          cpf: data.cpf ? formatCPF(data.cpf) : '',
          email: data.email || user.email || '',
          whatsapp: data.whatsapp ? formatWhatsapp(data.whatsapp) : '',
        });
      }
    } else {
      setUserProfile(null);
    }
  }, [user]);

  useEffect(() => {
    if (!isSessionLoading) {
      fetchProductDetails();
      fetchUserProfile();
    }
  }, [isSessionLoading, fetchProductDetails, fetchUserProfile]);

  // Effect para rastrear o evento InitiateCheckout, garantindo que seja disparado apenas uma vez
  useEffect(() => {
    if (!hasTrackedInitiateCheckout.current && !isLoading && mainProduct && currentTotalPrice > 0 && userProfile && process.env.NODE_ENV === 'production') {
      const productIds = [mainProduct.id, ...selectedOrderBumps];
      const numItems = productIds.length;
      const firstName = userProfile.name?.split(' ')[0] || null;
      const lastName = userProfile.name?.split(' ').slice(1).join(' ') || null;

      trackInitiateCheckout(
        currentTotalPrice,
        'BRL',
        productIds,
        numItems,
        {
          email: userProfile.email,
          phone: userProfile.whatsapp,
          firstName: firstName,
          lastName: lastName,
        }
      );
      hasTrackedInitiateCheckout.current = true; // Marca como rastreado para não disparar novamente
    }
  }, [isLoading, mainProduct, currentTotalPrice, selectedOrderBumps, userProfile]);


  useEffect(() => {
    if (!mainProduct) return;

    let calculatedOriginalTotal = mainProduct.price;
    selectedOrderBumps.forEach((bumpId) => {
      const bumpProduct = orderBumps.find((p) => p.id === bumpId);
      if (bumpProduct) {
        calculatedOriginalTotal += bumpProduct.price;
      }
    });
    setOriginalTotalPrice(calculatedOriginalTotal);

    let total = calculatedOriginalTotal;
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
      // Add if not already present
      setSelectedOrderBumps((prev) => {
        if (!prev.includes(bumpId)) {
          return [...prev, bumpId];
        }
        return prev; // Already present, do nothing
      });
    } else {
      // Remove
      setSelectedOrderBumps((prev) => prev.filter((id) => id !== bumpId));
    }
  };

  const handleCouponApplied = (coupon: Coupon | null) => {
    setAppliedCoupon(coupon);
  };

  const handleFinalizePurchase = async () => {
    if (!checkoutFormRef.current) {
      showError("Erro: Formulário de checkout não disponível.");
      return;
    }

    const isCheckoutFormValid = await checkoutFormRef.current.submitForm();
    if (!isCheckoutFormValid) {
      showError("Por favor, preencha todos os dados do cliente corretamente.");
      return;
    }

    const customerData = checkoutFormRef.current.getValues();
    let cardData = null;

    if (paymentMethod === "CREDIT_CARD") {
      if (!creditCardFormRef.current) {
        showError("Erro: Formulário de cartão de crédito não disponível.");
        return;
      }
      const isCreditCardFormValid = await creditCardFormRef.current.submitForm();
      if (!isCreditCardFormValid) {
        showError("Por favor, preencha todos os dados do cartão corretamente.");
        return;
      }
      cardData = creditCardFormRef.current.getValues(); // Get raw card data
    }

    await handleProcessPayment(customerData, cardData);
  };

  const handleProcessPayment = async (
    customerData: { name: string; cpf: string; email: string; whatsapp: string },
    cardData: any | null // Raw card data, or null for PIX
  ) => {
    if (!mainProduct) {
      showError("Nenhum produto principal selecionado.");
      return;
    }

    setIsSubmitting(true);

    const productIdsToPurchase = [mainProduct.id, ...selectedOrderBumps];
    const cleanedCpf = customerData.cpf.replace(/[^\d]+/g, "");
    const cleanedWhatsapp = customerData.whatsapp.replace(/[^\d]+/g, "");

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          name: customerData.name,
          email: customerData.email,
          cpf: cleanedCpf,
          whatsapp: cleanedWhatsapp,
          productIds: productIdsToPurchase,
          coupon_code: appliedCoupon?.code,
          paymentMethod: paymentMethod,
          creditCard: cardData, // Pass raw card data to Edge Function
          metaTrackingData: { // Pass Meta tracking data including current URL
            ...metaTrackingData,
            event_source_url: window.location.href,
          },
        },
      });

      if (error) {
        showError("Erro ao criar pagamento: " + error.message);
        console.error("Edge Function error:", error);
      } else if (data) {
        if (paymentMethod === "PIX" && data.payload && data.encodedImage && data.orderId && data.id) { // Check for flat PIX data
          showSuccess("Pagamento PIX criado com sucesso!");
          setModalPixDetails(data); // Pass the entire flat data object
          setModalTotalPrice(currentTotalPrice);
          setModalOrderId(data.orderId);
          setModalAsaasPaymentId(data.id); // Set Asaas Payment ID
          setIsPixModalOpen(true);
        } else if (paymentMethod === "CREDIT_CARD") {
          // Asaas response for credit card payment status
          if (data.status === "CONFIRMED") {
            showSuccess("Pagamento com cartão de crédito aprovado!");
            navigate("/confirmacao", { state: { orderId: data.orderId, totalPrice: currentTotalPrice } }); // Pass data to confirmation
          } else if (data.status === "PENDING") {
            showSuccess("Pagamento com cartão de crédito pendente. Verifique seu e-mail.");
            navigate("/processando-pagamento"); // Or a specific pending page
          } else if (data.status === "REFUSED") {
            showError("Pagamento com cartão de crédito recusado. Tente novamente ou use outro cartão.");
          } else {
            showError("Erro desconhecido ao processar pagamento com cartão.");
            console.error("Unexpected credit card payment status:", data);
          }
        } else {
          showError("Erro desconhecido ao processar pagamento.");
          console.error("Unexpected response from Edge Function:", data);
        }
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

  const selectedOrderBumpsDetails = orderBumps.filter(bump => selectedOrderBumps.includes(bump.id));

  const orderSummarySection = (
    <OrderSummaryAccordion
      mainProduct={mainProduct}
      selectedOrderBumpsDetails={selectedOrderBumpsDetails}
      originalTotalPrice={originalTotalPrice}
      currentTotalPrice={currentTotalPrice}
      appliedCoupon={appliedCoupon}
    />
  );

  const orderBumpsSection = orderBumps.length > 0 && (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-blue-700 mb-4">Leve também...</h2>
      {orderBumps.map((bump) => (
        <OrderBumpCard
          key={bump.id}
          product={bump}
          isSelected={selectedOrderBumps.includes(bump.id)}
          onToggle={handleToggleOrderBump}
        />
      ))}
    </div>
  );

  const couponInputSection = (
    <CouponInputCard
      onCouponApplied={handleCouponApplied}
    />
  );

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <CheckoutHeader />
      <main className="flex-1 p-4 md:p-8 max-w-md mx-auto w-full pb-40 md:max-w-6xl min-h-[calc(100vh-64px)]"> {/* Aumentado pb-32 para pb-40 */}
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Finalizar Compra</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Coluna Esquerda: Formulário, Bumps, Cupom */}
          <div className="space-y-6">
            {/* Main Product Card */}
            {mainProduct && <MainProductDisplayCard product={mainProduct} />}

            {/* Order Bumps Section */}
            {orderBumpsSection}

            {/* Coupon Input Section */}
            {couponInputSection}

            {/* Payment Method Selection */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Selecione o Método de Pagamento:</h2>
              <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "PIX" | "CREDIT_CARD")} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="PIX">PIX</TabsTrigger>
                  <TabsTrigger value="CREDIT_CARD">Cartão de Crédito</TabsTrigger>
                </TabsList>
                <TabsContent value="PIX" className="mt-4 text-gray-600">
                  Pague rapidamente com PIX. O QR Code será exibido após você preencher seus dados e finalizar a compra.
                </TabsContent>
                <TabsContent value="CREDIT_CARD" className="mt-4 space-y-4"> {/* Added space-y-4 for spacing */}
                  <p className="text-gray-600">Preencha os dados do seu cartão para finalizar a compra.</p>
                  <CreditCardForm
                    ref={creditCardFormRef}
                    isLoading={isSubmitting}
                  />
                </TabsContent>
              </Tabs>
            </div>

            {/* Checkout Form Section */}
            <div className="bg-white p-6 rounded-xl shadow-lg">
              <h2 className="text-2xl font-bold mb-4 text-gray-800">Estamos quase lá! Complete seus dados:</h2>
              <CheckoutForm
                ref={checkoutFormRef}
                onSubmit={() => { /* Handled by handleFinalizePurchase */ }}
                isLoading={isSubmitting}
                initialData={userProfile || undefined}
              />
            </div>
          </div>
          {/* Coluna Direita: Resumo do Pedido */}
          <div className="space-y-6">
            {orderSummarySection}
          </div>
        </div>
      </main>

      <FixedBottomBar
        totalPrice={currentTotalPrice}
        isSubmitting={isSubmitting}
        onSubmit={handleFinalizePurchase} // Call the new unified handler
      />

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        orderId={modalOrderId}
        pixDetails={modalPixDetails} // This now receives the flat object
        totalPrice={modalTotalPrice}
        asaasPaymentId={modalAsaasPaymentId} // Pass the Asaas Payment ID
      />
    </div>
  );
};

export default Checkout;
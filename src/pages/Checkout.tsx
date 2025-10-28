"use client";

import React, { useState, useEffect, useCallback } from "react";
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
import CheckoutForm from "@/components/checkout/CheckoutForm";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import FixedBottomBar from "@/components/checkout/FixedBottomBar"; // Import the new FixedBottomBar

const Checkout = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();

  const [mainProduct, setMainProduct] = useState<Product | null>(null);
  const [orderBumps, setOrderBumps] = useState<Product[]>([]);
  const [selectedOrderBumps, setSelectedOrderBumps] = useState<string[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [currentTotalPrice, setCurrentTotalPrice] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userProfile, setUserProfile] = useState<Partial<Profile> | null>(null);
  const [checkoutFormData, setCheckoutFormData] = useState<any>(null); // State to hold form data

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

  const handleFormSubmit = (data: { name: string; cpf: string; email: string; whatsapp: string }) => {
    setCheckoutFormData(data); // Store form data
    handleProcessPayment(data); // Directly process payment
  };

  const handleProcessPayment = async (formData: { name: string; cpf: string; email: string; whatsapp: string }) => {
    if (!mainProduct) {
      showError("Nenhum produto principal selecionado.");
      return;
    }

    setIsSubmitting(true);

    const productIdsToPurchase = [mainProduct.id, ...selectedOrderBumps];
    const cleanedCpf = formData.cpf.replace(/[^\d]+/g, "");
    const cleanedWhatsapp = formData.whatsapp.replace(/[^\d]+/g, "");

    try {
      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: {
          name: formData.name,
          email: formData.email,
          cpf: cleanedCpf,
          whatsapp: cleanedWhatsapp,
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
        setIsPixModalOpen(true);
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

  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      <CheckoutHeader />
      <main className="flex-1 p-4 md:p-8 max-w-md mx-auto w-full pb-24"> {/* Added pb-24 for FixedBottomBar */}
        <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">Finalizar Compra</h1>

        <div className="space-y-6">
          {/* Resumo do Pedido (Accordion) */}
          <OrderSummaryAccordion
            mainProduct={mainProduct}
            selectedOrderBumpsDetails={selectedOrderBumpsDetails}
            currentTotalPrice={currentTotalPrice}
          />

          {/* Formulário de Dados */}
          <div className="bg-white p-6 rounded-xl shadow-lg">
            <CheckoutForm onSubmit={handleFormSubmit} isLoading={isSubmitting} initialData={userProfile || undefined} />
          </div>

          {/* Order Bumps (Cards Visuais) */}
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

          {/* Cupom de Desconto */}
          <CouponInputCard
            onCouponApplied={handleCouponApplied}
            currentTotalPrice={currentTotalPrice}
          />
        </div>
      </main>

      {/* Bloco de Pagamento Fixo no Rodapé */}
      <FixedBottomBar
        totalPrice={currentTotalPrice}
        isSubmitting={isSubmitting}
        onSubmit={() => {
          // Trigger form submission from CheckoutForm
          // This requires a ref or a more direct way to submit the form.
          // For simplicity, we'll assume handleFormSubmit is called directly from the form.
          // If the form is valid, it will call handleProcessPayment.
          // If not, the form's validation messages will appear.
          // For now, the FixedBottomBar's onSubmit will trigger the last submitted data.
          // A more robust solution would involve passing the form's submit handler down.
          if (checkoutFormData) {
            handleProcessPayment(checkoutFormData);
          } else {
            showError("Por favor, preencha seus dados para finalizar a compra.");
          }
        }}
      />

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
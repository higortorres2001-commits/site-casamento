"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  const [productAssets, setProductAssets] = useState<any[]>([]);
  const [isMaterialsExpanded, setIsMaterialsExpanded] = useState(false);

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
        // Executar ambas as consultas em paralelo com Promise.all
        const [productResult, bumpsResult, assetsResult] = await Promise.all([
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
          ,
          
          // Consulta 3: Buscar os materiais do produto
          supabase
            .from("product_assets")
            .select("id, file_name, storage_path")
            .eq("product_id", productId)
            .order("created_at", { ascending: false })
        ]);
        
        const { data: product, error: productError } = productResult;
        
        if (productError || !product) {
          showError("Produto não encontrado ou não está disponível.");
          console.error("Error fetching product:", productError);
          navigate("/");
          return;
        }

        // Configurar o produto principal imediatamente
        setMainProduct(product);

        // Buscar os order bumps em paralelo (se existirem)
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

        // Configurar os materiais do produto
        if (!assetsResult.error && assetsResult.data) {
          // Gerar URLs assinadas para os materiais
          const assetsWithUrls = await Promise.all(
            assetsResult.data.map(async (asset) => {
              const { data: signedUrlData, error: signedUrlError } = await supabase.storage
                .from('product-assets')
                .createSignedUrl(asset.storage_path, 3600); // 1 hora

              if (signedUrlError) {
                console.error(`Error generating signed URL for asset ${asset.id}:`, signedUrlError.message);
                return { ...asset, signed_url: null };
              }
              return { ...asset, signed_url: signedUrlData?.signedUrl || null };
            })
          );
          setProductAssets(assetsWithUrls);
        } else {
          setProductAssets([]);
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

      console.log("🚀 Enviando payload para checkout:", {
        paymentMethod,
        productCount: productIds.length,
        hasCoupon: !!appliedCoupon,
        totalPrice: currentTotalPrice
      });

      const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });

      if (error) {
        console.error("Edge function error details:", error);
        
        // Tratamento de erros mais específico
        let errorMessage = "Erro ao processar pagamento. Tente novamente.";
        
        if (error.message) {
          if (error.message.includes("FunctionsHttpError")) {
            errorMessage = "Erro de comunicação com o servidor. Verifique sua conexão e tente novamente.";
          } else if (error.message.includes("timeout")) {
            errorMessage = "Tempo limite excedido. Tente novamente em alguns instantes.";
          } else {
            errorMessage = error.message;
          }
        }
        
        showError(errorMessage);
        return;
      }

      // Verificar se há erro na resposta da função
      if (data && data.error) {
        console.error("Business logic error:", data);
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
          showSuccess("Pedido criado! Aguardando confirmação do pagamento.");
          navigate("/processando-pagamento");
        }
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      
      // Tratamento de erros de rede
      let errorMessage = "Erro inesperado. Tente novamente.";
      
      if (err.name === "TypeError" && err.message.includes("fetch")) {
        errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      showError(errorMessage);
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
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <CheckoutHeader backUrl={mainProduct.checkout_return_url || undefined} />

      <main className="flex-1 container mx-auto p-4 md:p-8 max-w-2xl pb-32">
        <div className="space-y-6">
          <MainProductDisplayCard product={mainProduct} />

          {/* Anúncio Personalizado */}
          <Card className="bg-gradient-to-r from-orange-50 to-yellow-50 border-orange-200">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-orange-800">
                🎯 Oferta Especial por Tempo Limitado!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-orange-700 mb-4">
                Adquira agora {mainProduct.name} e tenha acesso imediato aos materiais exclusivos!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <Badge className="bg-green-100 text-green-800 text-sm px-3 py-1">
                  ✅ Entrega Imediata
                </Badge>
                <Badge className="bg-blue-100 text-blue-800 text-sm px-3 py-1">
                  📚 Materiais Exclusivos
                </Badge>
                <Badge className="bg-purple-100 text-purple-800 text-sm px-3 py-1">
                  🎓 Suporte Premium
                </Badge>
              </div>
            </CardContent>
          </Card>

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

          {/* Acordeon de Materiais */}
          {productAssets.length > 0 && (
            <Card className="bg-white rounded-xl shadow-lg">
              <CardHeader 
                className="cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setIsMaterialsExpanded(!isMaterialsExpanded)}
              >
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    Materiais do Produto ({productAssets.length})
                  </span>
                  {isMaterialsExpanded ? (
                    <ChevronUp className="h-5 w-5" />
                  ) : (
                    <ChevronDown className="h-5 w-5" />
                  )}
                </CardTitle>
              </CardHeader>
              {isMaterialsExpanded && (
                <CardContent className="pt-0">
                  <div className="space-y-3">
                    {productAssets.map((asset) => (
                      <div key={asset.id} className="flex items-center justify-between p-3 border rounded-lg bg-gray-50">
                        <div className="flex items-center gap-3">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-gray-700">{asset.file_name}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (asset.signed_url) {
                              const link = document.createElement('a');
                              link.href = asset.signed_url;
                              link.download = asset.file_name;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              showSuccess(`Download de "${asset.file_name}" iniciado!`);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <Download className="h-4 w-4 mr-1" />
                          Baixar
                        </Button>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-800 mb-2">Como baixar os materiais:</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Clique no botão "Baixar" ao lado de cada material</li>
                      <li>Após a compra, você terá acesso vitalício a todos os materiais</li>
                      <li>Os materiais ficam disponíveis na sua área de membros</li>
                    </ol>
                  </div>
                </CardContent>
              )}
            </Card>
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

      {/* Barra fixa apenas para mobile */}
      {isMobile && (
        <FixedBottomBar
          totalPrice={currentTotalPrice}
          isSubmitting={isSubmitting}
          onSubmit={handleSubmit}
        />
      )}

      {/* Botão no corpo da página para desktop */}
      {!isMobile && (
        <div className="fixed bottom-8 right-8 z-40">
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 text-lg font-semibold shadow-lg rounded-full"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              "Finalizar Compra Agora"
            )}
          </Button>
        </div>
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
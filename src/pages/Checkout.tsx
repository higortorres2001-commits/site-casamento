"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Product, Coupon } from "@/types";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2, ChevronDown, ChevronUp, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Separator } from "@/components/ui/separator";

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

      console.log("🚀 Enviando payload com cupom:", {
        coupon_code: appliedCoupon?.code || null,
        coupon_applied: !!appliedCoupon,
        coupon_value: appliedCoupon?.value,
        coupon_type: appliedCoupon?.discount_type,
        original_total: originalTotalPrice,
        final_total: currentTotalPrice
      });

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
          {/* Coluna Principal - Produto e Formulário */}
          <div className="lg:col-span-2 space-y-8">
            {/* 1. Produto Principal */}
            <div className="space-y-6">
              <MainProductDisplayCard product={mainProduct} />

              {/* Banner Promocional */}
              <Card className="bg-gradient-to-r from-orange-50 via-yellow-50 to-orange-50 border-orange-200 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center">
                      <span className="text-2xl">🎯</span>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-orange-800">
                        Oferta Especial por Tempo Limitado!
                      </h3>
                      <p className="text-orange-700">
                        Adquira agora e tenha acesso imediato aos materiais exclusivos!
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
                      ✅ Entrega Imediata
                    </Badge>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
                      📚 Materiais Exclusivos
                    </Badge>
                    <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-3 py-1">
                      🎓 Suporte Premium
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 2. Order Bumps */}
            {orderBumps.length > 0 && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Aproveite também estas ofertas especiais!
                  </h2>
                  <p className="text-gray-600">
                    Produtos complementares selecionados especialmente para você
                  </p>
                </div>
                <div className="space-y-4">
                  {orderBumps.map((bump) => (
                    <OrderBumpCard
                      key={bump.id}
                      product={bump}
                      isSelected={selectedOrderBumps.includes(bump.id)}
                      onToggle={handleOrderBumpToggle}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 3. Materiais do Produto */}
            {productAssets.length > 0 && (
              <Card className="bg-white shadow-lg border-blue-200">
                <CardHeader 
                  className="cursor-pointer hover:bg-blue-50 transition-colors rounded-t-lg"
                  onClick={() => setIsMaterialsExpanded(!isMaterialsExpanded)}
                >
                  <CardTitle className="flex items-center justify-between text-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <span className="text-blue-800">Materiais Inclusos</span>
                        <p className="text-sm text-blue-600 font-normal">
                          {productAssets.length} arquivo(s) disponível(is)
                        </p>
                      </div>
                    </div>
                    {isMaterialsExpanded ? (
                      <ChevronUp className="h-5 w-5 text-blue-600" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-blue-600" />
                    )}
                  </CardTitle>
                </CardHeader>
                {isMaterialsExpanded && (
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    <div className="space-y-3">
                      {productAssets.map((asset) => (
                        <div key={asset.id} className="flex items-center justify-between p-4 border border-blue-100 rounded-lg bg-blue-50/50 hover:bg-blue-50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <FileText className="h-4 w-4 text-blue-600" />
                            </div>
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
                            className="text-blue-600 hover:text-blue-800 border-blue-200 hover:bg-blue-50"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Baixar
                          </Button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
                        <span className="text-lg">📋</span>
                        Como acessar seus materiais:
                      </h4>
                      <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                        <li>Após a compra, você receberá acesso vitalício a todos os materiais</li>
                        <li>Os arquivos ficam disponíveis na sua área de membros</li>
                        <li>Você pode baixar quantas vezes quiser, quando quiser</li>
                      </ol>
                    </div>
                  </CardContent>
                )}
              </Card>
            )}

            {/* 4. Formulário de Dados */}
            <Card className="bg-white shadow-lg">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                <CardTitle className="text-xl text-gray-800 flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold">1</span>
                  </div>
                  Seus Dados
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <CheckoutForm
                  ref={checkoutFormRef}
                  onSubmit={() => {}}
                  isLoading={isSubmitting}
                />
              </CardContent>
            </Card>

            {/* 5. Método de Pagamento */}
            <Card className="bg-white shadow-lg">
              <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
                <CardTitle className="text-xl text-gray-800 flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <span className="text-orange-600 font-bold">2</span>
                  </div>
                  Método de Pagamento
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "PIX" | "CREDIT_CARD")}>
                  <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="PIX" className="flex items-center gap-2">
                      <span className="text-lg">💳</span>
                      PIX
                    </TabsTrigger>
                    <TabsTrigger value="CREDIT_CARD" className="flex items-center gap-2">
                      <span className="text-lg">💰</span>
                      Cartão de Crédito
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="PIX" className="mt-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-2xl">⚡</span>
                        <h4 className="font-semibold text-green-800">Pagamento via PIX</h4>
                      </div>
                      <p className="text-sm text-green-700">
                        Você receberá um QR Code para pagamento instantâneo via PIX após finalizar o pedido.
                        O acesso é liberado automaticamente após a confirmação.
                      </p>
                    </div>
                  </TabsContent>
                  <TabsContent value="CREDIT_CARD" className="mt-4">
                    <CreditCardForm
                      ref={creditCardFormRef}
                      isLoading={isSubmitting}
                      totalPrice={currentTotalPrice}
                    />
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Coluna Lateral - Resumo do Pedido */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <OrderSummaryAccordion
                mainProduct={mainProduct}
                selectedOrderBumpsDetails={selectedOrderBumpsDetails}
                originalTotalPrice={originalTotalPrice}
                currentTotalPrice={currentTotalPrice}
                appliedCoupon={appliedCoupon}
                onCouponApplied={handleCouponApplied}
              />

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
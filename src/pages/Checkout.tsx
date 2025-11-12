import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Smartphone, Shield, ArrowLeft, Download, Copy, Check } from "lucide-react";
import { formatCurrency } from "@/utils/formatters";
import { usePixelEvents } from "@/hooks/use-pixel-initialization";

export default function Checkout() {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { trackPurchaseInit, trackPaymentInfo, trackPurchase } = usePixelEvents();

  // Estados do formulário
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [cpf, setCpf] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
  const [couponCode, setCouponCode] = useState("");
  const [applyCoupon, setApplyCoupon] = useState(false);
  const [installments, setInstallments] = useState<any[]>([]);
  const [selectedInstallment, setSelectedInstallment] = useState<number>(1);

  // Estados do produto e carregamento
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [pixData, setPixData] = useState<any>(null);
  const [copiedPix, setCopiedPix] = useState(false);

  // Estados do cartão de crédito
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [expiryMonth, setExpiryMonth] = useState("");
  const [expiryYear, setExpiryYear] = useState("");
  const [cvv, setCvv] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [addressNumber, setAddressNumber] = useState("");

  // Carregar produto
  useEffect(() => {
    const loadProduct = async () => {
      try {
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (error) throw error;
        setProduct(data);
      } catch (error) {
        console.error("Erro ao carregar produto:", error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o produto",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (productId) {
      loadProduct();
    }
  }, [productId]);

  // Calcular parcelas
  useEffect(() => {
    const calculateInstallments = async () => {
      if (!product) return;

      try {
        const response = await fetch(
          "https://hsxhmpxrtfvydnfxtcbx.supabase.co/functions/v1/calculate-installments",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ totalPrice: product.price }),
          }
        );

        const data = await response.json();
        if (data.installments) {
          setInstallments(data.installments);
        }
      } catch (error) {
        console.error("Erro ao calcular parcelas:", error);
      }
    };

    calculateInstallments();
  }, [product]);

  // Formatar CPF
  const formatCPF = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{3})(\d{2})$/);
    if (match) {
      return `${match[1]}.${match[2]}.${match[3]}-${match[4]}`;
    }
    return cleaned;
  };

  // Formatar WhatsApp
  const formatWhatsApp = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{2})(\d{5})(\d{4})$/);
    if (match) {
      return `(${match[1]}) ${match[2]}-${match[3]}`;
    }
    return cleaned;
  };

  // Formatar número do cartão
  const formatCardNumber = (value: string) => {
    const cleaned = value.replace(/\D/g, "");
    const match = cleaned.match(/^(\d{4})(\d{4})(\d{4})(\d{4})$/);
    if (match) {
      return `${match[1]} ${match[2]} ${match[3]} ${match[4]}`;
    }
    return cleaned.replace(/(\d{4})/g, "$1 ").trim();
  };

  // Copiar código PIX
  const copyPixCode = () => {
    if (pixData?.payload) {
      navigator.clipboard.writeText(pixData.payload);
      setCopiedPix(true);
      setTimeout(() => setCopiedPix(false), 2000);
    }
  };

  // Baixar comprovante PIX
  const downloadPixImage = () => {
    if (pixData?.encodedImage) {
      const link = document.createElement("a");
      link.href = `data:image/png;base64,${pixData.encodedImage}`;
      link.download = "qrcode-pix.png";
      link.click();
    }
  };

  // Processar pagamento
  const handleSubmit = async () => {
    if (!product) return;

    // Validar campos
    if (!name || !email || !cpf || !whatsapp) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);

    try {
      const payload: any = {
        name,
        email,
        cpf: cpf.replace(/\D/g, ""),
        whatsapp: whatsapp.replace(/\D/g, ""),
        productIds: [product.id],
        paymentMethod,
        metaTrackingData: {
          fbc: document.cookie.includes("_fbc") ? document.cookie.split("_fbc=")[1]?.split(";")[0] : null,
          fbp: document.cookie.includes("_fbp") ? document.cookie.split("_fbp=")[1]?.split(";")[0] : null,
          event_source_url: window.location.href,
        },
      };

      if (applyCoupon && couponCode) {
        payload.coupon_code = couponCode;
      }

      if (paymentMethod === "CREDIT_CARD") {
        if (!cardNumber || !cardName || !expiryMonth || !expiryYear || !cvv || !postalCode || !addressNumber) {
          toast({
            title: "Dados do cartão incompletos",
            description: "Preencha todos os dados do cartão de crédito",
            variant: "destructive",
          });
          setProcessing(false);
          return;
        }

        payload.creditCard = {
          holderName: cardName,
          cardNumber: cardNumber.replace(/\s/g, ""),
          expiryMonth,
          expiryYear,
          ccv: cvv,
          postalCode: postalCode.replace(/\D/g, ""),
          addressNumber,
          installmentCount: selectedInstallment,
        };
      }

      const response = await fetch(
        "https://hsxhmpxrtfvydnfxtcbx.supabase.co/functions/v1/create-asaas-payment",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (paymentMethod === "PIX") {
        setPixData(data);
        trackPaymentInfo();
      } else {
        trackPurchase();
        navigate("/confirmacao");
      }
    } catch (error: any) {
      console.error("Erro no pagamento:", error);
      toast({
        title: "Erro no pagamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">Produto não encontrado</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Voltar para a página inicial
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Button
        variant="ghost"
        onClick={() => navigate("/")}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Formulário de pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Informações de Pagamento</CardTitle>
            <CardDescription>
              Preencha seus dados para completar a compra
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cpf">CPF *</Label>
              <Input
                id="cpf"
                value={cpf}
                onChange={(e) => setCpf(formatCPF(e.target.value))}
                placeholder="000.000.000-00"
                maxLength={14}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp *</Label>
              <Input
                id="whatsapp"
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatWhatsApp(e.target.value))}
                placeholder="(00) 00000-0000"
                maxLength={15}
              />
            </div>

            {/* Método de pagamento */}
            <div className="space-y-2">
              <Label>Método de Pagamento</Label>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(value) => setPaymentMethod(value as "PIX" | "CREDIT_CARD")}
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="PIX" id="pix" />
                  <Label htmlFor="pix" className="flex items-center gap-2 cursor-pointer">
                    <Smartphone className="h-4 w-4" />
                    PIX
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="CREDIT_CARD" id="card" />
                  <Label htmlFor="card" className="flex items-center gap-2 cursor-pointer">
                    <CreditCard className="h-4 w-4" />
                    Cartão de Crédito
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {/* Dados do cartão */}
            {paymentMethod === "CREDIT_CARD" && (
              <div className="space-y-4 border-t pt-4">
                <div className="space-y-2">
                  <Label htmlFor="cardNumber">Número do Cartão *</Label>
                  <Input
                    id="cardNumber"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    placeholder="0000 0000 0000 0000"
                    maxLength={19}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cardName">Nome no Cartão *</Label>
                  <Input
                    id="cardName"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    placeholder="Nome igual no cartão"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="expiryMonth">Mês *</Label>
                    <Input
                      id="expiryMonth"
                      value={expiryMonth}
                      onChange={(e) => setExpiryMonth(e.target.value)}
                      placeholder="MM"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expiryYear">Ano *</Label>
                    <Input
                      id="expiryYear"
                      value={expiryYear}
                      onChange={(e) => setExpiryYear(e.target.value)}
                      placeholder="AA"
                      maxLength={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cvv">CVV *</Label>
                    <Input
                      id="cvv"
                      value={cvv}
                      onChange={(e) => setCvv(e.target.value)}
                      placeholder="000"
                      maxLength={3}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postalCode">CEP *</Label>
                  <Input
                    id="postalCode"
                    value={postalCode}
                    onChange={(e) => setPostalCode(e.target.value)}
                    placeholder="00000-000"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="addressNumber">Número do Endereço *</Label>
                  <Input
                    id="addressNumber"
                    value={addressNumber}
                    onChange={(e) => setAddressNumber(e.target.value)}
                    placeholder="Número"
                  />
                </div>

                {/* Parcelas */}
                {installments.length > 0 && (
                  <div className="space-y-2">
                    <Label>Parcelas</Label>
                    <Select
                      value={selectedInstallment.toString()}
                      onValueChange={(value) => setSelectedInstallment(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a quantidade de parcelas" />
                      </SelectTrigger>
                      <SelectContent>
                        {installments.map((installment) => (
                          <SelectItem
                            key={installment.installmentNumber}
                            value={installment.installmentNumber.toString()}
                          >
                            {installment.installmentNumber}x de {formatCurrency(installment.installmentValue)} 
                            {installment.installmentNumber > 1 && ` (juros: ${installment.interestPercentage}%)`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            {/* Cupom de desconto */}
            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="applyCoupon"
                  checked={applyCoupon}
                  onCheckedChange={(checked) => setApplyCoupon(checked as boolean)}
                />
                <Label htmlFor="applyCoupon" className="cursor-pointer">
                  Tenho um cupom de desconto
                </Label>
              </div>
              {applyCoupon && (
                <Input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value)}
                  placeholder="Código do cupom"
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Resumo do pedido */}
        <Card>
          <CardHeader>
            <CardTitle>Resumo do Pedido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product && (
              <>
                <div className="flex justify-between">
                  <span className="font-medium">{product.name}</span>
                  <span>{formatCurrency(product.price)}</span>
                </div>
                <div className="border-t pt-4">
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(product.price)}</span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PIX Modal */}
      {pixData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6 z-50">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Pagamento via PIX
              </CardTitle>
              <CardDescription>
                Escaneie o QR Code ou copie o código para pagar
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {pixData.encodedImage && (
                <div className="flex justify-center">
                  <img
                    src={`data:image/png;base64,${pixData.encodedImage}`}
                    alt="QR Code PIX"
                    className="w-48 h-48"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label>Código PIX</Label>
                <div className="flex gap-2">
                  <Input
                    value={pixData.payload}
                    readOnly
                    className="font-mono text-xs"
                  />
                  <Button
                    variant="outline"
                    onClick={copyPixCode}
                  >
                    {copiedPix ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={downloadPixImage}
                  className="flex-1"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Baixar QR Code
                </Button>
                <Button
                  onClick={() => {
                    setPixData(null);
                    navigate("/confirmacao");
                  }}
                  className="flex-1"
                >
                  Já paguei
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Botão de submit fixo */}
      <div className="fixed bottom-8 right-8 z-40">
        <Button
          onClick={handleSubmit}
          disabled={processing}
          size="lg"
          className="shadow-lg"
        >
          {processing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            <>
              <Shield className="h-4 w-4 mr-2" />
              {paymentMethod === "PIX" ? "Gerar PIX" : `Pagar ${formatCurrency(product?.price || 0)}`}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
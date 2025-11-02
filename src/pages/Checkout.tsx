// Modificando apenas a função handleCheckout para incluir um fallback de chamada direta
// Mantenha o resto do arquivo igual

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

  try {
    // Primeira tentativa: usar o SDK do Supabase
    let data;
    let error;
    
    try {
      const result = await supabase.functions.invoke("create-asaas-payment", {
        body: payload,
      });
      data = result.data;
      error = result.error;
    } catch (sdkError: any) {
      console.error("SDK invocation failed, trying direct fetch:", sdkError);
      
      // Se falhar, tenta chamada direta via fetch
      const supabaseUrl = "https://hsxhmpxrtfvydnfxtcbx.supabase.co";
      const functionUrl = `${supabaseUrl}/functions/v1/create-asaas-payment`;
      
      // Obter o token de autenticação atual (se o usuário estiver logado)
      const { data: authData } = await supabase.auth.getSession();
      const token = authData?.session?.access_token;
      
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      
      // Adicionar token de autenticação se disponível
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      // Fazer chamada direta via fetch
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Direct fetch failed: ${errorData.error || response.statusText}`);
      }
      
      data = await response.json();
    }

    if (error) {
      // Log detalhado do erro da Edge Function
      await supabase.from("logs").insert({
        level: "error",
        context: "client-checkout",
        message: `Failed to finalize checkout: ${error.message}`,
        metadata: { 
          userId: user?.id, 
          payload, 
          errorName: error.name,
          errorMessage: error.message,
          errorDetails: JSON.stringify(error),
        },
      });
      
      // Mensagem de erro mais clara para o usuário
      showError(`Erro ao finalizar compra: ${error.message || 'Falha na comunicação com o servidor de pagamento.'}`);
      console.error("Checkout error:", error);
      
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
    // Log de erro inesperado (e.g., erro de rede antes de chegar ao Supabase)
    await supabase.from("logs").insert({
      level: "error",
      context: "client-checkout",
      message: `Unhandled error during checkout: ${err.message}`,
      metadata: { userId: user?.id, errorStack: err.stack, payload },
    });
    showError(`Erro inesperado ao finalizar compra: ${err.message}. Verifique sua conexão.`);
    console.error("Unexpected checkout error:", err);
  } finally {
    setIsSubmitting(false);
  }
};
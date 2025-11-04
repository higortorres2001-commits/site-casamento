"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, CheckCircle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const SyncSpecificPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [paymentId, setPaymentId] = useState("f0449709-66ff-41cc-8a94-62b40399cb02");
  const [paymentData, setPaymentData] = useState<any>(null);
  const [syncData, setSyncData] = useState({
    email: "",
    name: "",
    cpf: "",
    whatsapp: "",
    productIds: [] as string[],
    totalValue: 0,
    installmentCount: 1
  });

  const searchPayment = async () => {
    if (!paymentId.trim()) {
      showError("ID do pagamento é obrigatório");
      return;
    }

    setIsSearching(true);
    try {
      // Buscar pagamento específico no Asaas
      const { data, error } = await supabase.functions.invoke("fetch-asaas-payments", {
        body: { paymentId }
      });

      if (error) {
        showError("Erro ao buscar pagamento: " + error.message);
        console.error("Search error:", error);
        return;
      }

      if (data.payments && data.payments.length > 0) {
        const payment = data.payments[0];
        setPaymentData(payment);
        
        // Preencher dados para sincronização
        setSyncData({
          email: payment.customer?.email || "",
          name: payment.customer?.name || "",
          cpf: payment.customer?.cpfCnpj || "",
          whatsapp: payment.customer?.phone || "",
          productIds: [], // Você precisará informar os IDs dos produtos
          totalValue: payment.value || 0,
          installmentCount: payment.installmentCount || 1
        });

        showSuccess("Pagamento encontrado! Preencha os IDs dos produtos e sincronize.");
      } else {
        showError("Pagamento não encontrado no Asaas");
        setPaymentData(null);
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
      console.error("Unexpected error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSync = async () => {
    if (!syncData.email || !syncData.productIds.length) {
      showError("Email e IDs dos produtos são obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-payment", {
        body: {
          ...syncData,
          asaasPaymentId: paymentId
        }
      });

      if (error) {
        showError("Erro ao sincronizar pagamento: " + error.message);
        console.error("Sync error:", error);
      } else {
        showSuccess("Pagamento sincronizado com sucesso!");
        console.log("Sync result:", data);
        
        // Limpar formulário após sucesso
        setPaymentData(null);
        setSyncData({
          email: "",
          name: "",
          cpf: "",
          whatsapp: "",
          productIds: [],
          totalValue: 0,
          installmentCount: 1
        });
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
      console.error("Unexpected error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Sincronizar Pagamento Específico
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Busca de Pagamento */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">1. Buscar Pagamento no Asaas</h3>
            <div className="flex gap-2">
              <Input
                value={paymentId}
                onChange={(e) => setPaymentId(e.target.value)}
                placeholder="ID do pagamento no Asaas"
                className="flex-1"
              />
              <Button
                onClick={searchPayment}
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {paymentData && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h4 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Pagamento Encontrado
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Cliente:</strong> {paymentData.customer?.name}</div>
                  <div><strong>Email:</strong> {paymentData.customer?.email}</div>
                  <div><strong>CPF:</strong> {paymentData.customer?.cpfCnpj}</div>
                  <div><strong>WhatsApp:</strong> {paymentData.customer?.phone}</div>
                  <div><strong>Valor:</strong> R$ {paymentData.value?.toFixed(2)}</div>
                  <div><strong>Status:</strong> {paymentData.status}</div>
                  <div><strong>Parcelas:</strong> {paymentData.installmentCount || 1}</div>
                  <div><strong>Data:</strong> {new Date(paymentData.dueDate).toLocaleDateString()}</div>
                </div>
              </div>
            )}
          </div>

          {/* Dados para Sincronização */}
          {paymentData && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">2. Dados para Sincronização</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input
                    value={syncData.email}
                    onChange={(e) => setSyncData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nome</label>
                  <Input
                    value={syncData.name}
                    onChange={(e) => setSyncData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Nome completo"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">CPF</label>
                  <Input
                    value={syncData.cpf}
                    onChange={(e) => setSyncData(prev => ({ ...prev, cpf: e.target.value }))}
                    placeholder="00000000000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp</label>
                  <Input
                    value={syncData.whatsapp}
                    onChange={(e) => setSyncData(prev => ({ ...prev, whatsapp: e.target.value }))}
                    placeholder="DD999999999"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Total</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={syncData.totalValue}
                    onChange={(e) => setSyncData(prev => ({ ...prev, totalValue: parseFloat(e.target.value) }))}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Número de Parcelas</label>
                  <Input
                    type="number"
                    value={syncData.installmentCount}
                    onChange={(e) => setSyncData(prev => ({ ...prev, installmentCount: parseInt(e.target.value) }))}
                    placeholder="1"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium mb-1">IDs dos Produtos (separados por vírgula)</label>
                  <Input
                    value={syncData.productIds.join(', ')}
                    onChange={(e) => setSyncData(prev => ({ 
                      ...prev, 
                      productIds: e.target.value.split(',').map(id => id.trim()).filter(id => id) 
                    }))}
                    placeholder="id1, id2, id3"
                  />
                </div>
              </div>

              <Button
                onClick={handleSync}
                disabled={isLoading || !syncData.productIds.length}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sincronizando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sincronizar Pagamento
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            <p className="font-medium mb-2">Instruções:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Cole o ID do pagamento no campo acima</li>
              <li>Clique em "Buscar" para encontrar o pagamento no Asaas</li>
              <li>Confirme os dados encontrados</li>
              <li>Adicione os IDs dos produtos comprados</li>
              <li>Clique em "Sincronizar Pagamento"</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncSpecificPayment;
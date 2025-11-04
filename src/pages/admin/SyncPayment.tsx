"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sync } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const SyncPayment = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "beranrdo.bohrer.bohnen@gmail.com",
    name: "Bernardo Bohrer Bohnen",
    cpf: "05507462003",
    whatsapp: "54996667722",
    asaasPaymentId: "",
    productIds: ["ID_DO_PRODUTO_AQUI"], // Você precisa colocar o ID real do produto
    totalValue: 105.3,
    installmentCount: 3
  });

  const handleInputChange = (field: string, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSync = async () => {
    if (!formData.asaasPaymentId || !formData.productIds.length) {
      showError("ID do pagamento e IDs dos produtos são obrigatórios");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-external-payment", {
        body: formData
      });

      if (error) {
        showError("Erro ao sincronizar pagamento: " + error.message);
        console.error("Sync error:", error);
      } else {
        showSuccess("Pagamento sincronizado com sucesso!");
        console.log("Sync result:", data);
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
      console.error("Unexpected error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sync className="h-5 w-5" />
            Sincronizar Pagamento Externo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <Input
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nome</label>
              <Input
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">CPF</label>
              <Input
                value={formData.cpf}
                onChange={(e) => handleInputChange('cpf', e.target.value)}
                placeholder="00000000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <Input
                value={formData.whatsapp}
                onChange={(e) => handleInputChange('whatsapp', e.target.value)}
                placeholder="DD999999999"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">ID do Pagamento Asaas</label>
              <Input
                value={formData.asaasPaymentId}
                onChange={(e) => handleInputChange('asaasPaymentId', e.target.value)}
                placeholder="ID do pagamento no Asaas"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Valor Total</label>
              <Input
                type="number"
                step="0.01"
                value={formData.totalValue}
                onChange={(e) => handleInputChange('totalValue', parseFloat(e.target.value))}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Número de Parcelas</label>
              <Input
                type="number"
                value={formData.installmentCount}
                onChange={(e) => handleInputChange('installmentCount', parseInt(e.target.value))}
                placeholder="1"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">IDs dos Produtos (separados por vírgula)</label>
              <Input
                value={formData.productIds.join(', ')}
                onChange={(e) => handleInputChange('productIds', e.target.value.split(',').map(id => id.trim()))}
                placeholder="id1, id2, id3"
              />
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={handleSync}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Sync className="h-4 w-4 mr-2" />
                  Sincronizar Pagamento
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            <p className="font-medium mb-2">Instruções:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Preencha os dados do cliente</li>
              <li>Adicione o ID do pagamento do Asaas</li>
              <li>Adicione os IDs dos produtos comprados</li>
              <li>Clique em "Sincronizar Pagamento"</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SyncPayment;
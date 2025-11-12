"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  AlertTriangle, 
  RefreshCw, 
  Phone, 
  Mail, 
  User,
  Package,
  Calendar
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";

type FailedSale = {
  id: string;
  created_at: string;
  level: string;
  context: string;
  message: string;
  metadata: {
    CUSTOMER_CONTACT_DATA?: {
      name: string;
      email: string;
      cpf: string;
      whatsapp: string;
      productIds: string[];
      coupon_code?: string;
    };
    paymentMethod?: string;
    errorMessage?: string;
    MANUAL_FOLLOW_UP_REQUIRED?: boolean;
  };
};

const FailedSales = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [failedSales, setFailedSales] = useState<FailedSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [recovering, setRecovering] = useState<string | null>(null);

  const isAdmin = user?.email === "higor.torres8@gmail.com";

  const fetchFailedSales = useCallback(async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .eq("context", "create-asaas-payment-CRITICAL-FAILURE")
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) {
        showError("Erro ao carregar vendas perdidas: " + error.message);
        console.error("Error fetching failed sales:", error);
        setFailedSales([]);
      } else {
        setFailedSales(data || []);
      }
    } catch (error: any) {
      showError("Erro inesperado ao carregar vendas perdidas: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (!isSessionLoading && isAdmin) {
      fetchFailedSales();
    }
  }, [isSessionLoading, isAdmin, fetchFailedSales]);

  const handleRecoverSale = async (failedSale: FailedSale) => {
    const customerData = failedSale.metadata.CUSTOMER_CONTACT_DATA;
    if (!customerData) {
      showError("Dados do cliente não encontrados neste log.");
      return;
    }

    setRecovering(failedSale.id);
    
    try {
      const { data, error } = await supabase.functions.invoke("recover-failed-sale", {
        body: {
          customerData,
          paymentMethod: failedSale.metadata.paymentMethod || 'PIX',
          productIds: customerData.productIds,
          couponCode: customerData.coupon_code
        },
      });

      if (error) {
        showError("Erro ao recuperar venda: " + error.message);
        console.error("Error recovering sale:", error);
        return;
      }

      if (data?.error) {
        showError(data.error);
        return;
      }

      showSuccess(`Venda recuperada com sucesso! Pedido: ${data.orderId}`);
      
      // Marcar como resolvido nos logs
      await supabase.from('logs').insert({
        level: 'info',
        context: 'failed-sale-recovered',
        message: 'Failed sale recovered successfully via admin panel',
        metadata: {
          originalFailureId: failedSale.id,
          recoveredOrderId: data.orderId,
          recoveredUserId: data.userId,
          customerEmail: customerData.email,
          adminEmail: user?.email
        }
      });

      fetchFailedSales(); // Refresh the list
    } catch (error: any) {
      showError("Erro inesperado ao recuperar venda: " + error.message);
      console.error("Unexpected error recovering sale:", error);
    } finally {
      setRecovering(null);
    }
  };

  const copyContactInfo = (customerData: any) => {
    const contactInfo = `
Nome: ${customerData.name}
Email: ${customerData.email}
CPF: ${formatCPF(customerData.cpf)}
WhatsApp: ${formatWhatsapp(customerData.whatsapp)}
Produtos: ${customerData.productIds?.join(', ') || 'N/A'}
Cupom: ${customerData.coupon_code || 'Nenhum'}
    `.trim();

    navigator.clipboard.writeText(contactInfo)
      .then(() => showSuccess("Dados de contato copiados!"))
      .catch(() => showError("Falha ao copiar dados."));
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-slate-600">
            Você não tem permissão para acessar esta área.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            Vendas Perdidas
          </h1>
          <p className="text-gray-500">Recupere vendas que falharam no checkout</p>
        </div>
        <Button onClick={fetchFailedSales} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Falhas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{failedSales.length}</div>
            <p className="text-xs text-muted-foreground">
              Vendas que falharam no checkout
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Últimas 24h</CardTitle>
            <Calendar className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {failedSales.filter(sale => {
                const saleDate = new Date(sale.created_at);
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                return saleDate > yesterday;
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Falhas recentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Estimado Perdido</CardTitle>
            <Package className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              R$ {(failedSales.length * 100).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimativa baseada em ticket médio
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Vendas Perdidas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            Vendas que Falharam ({failedSales.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : failedSales.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg font-medium">Nenhuma venda perdida encontrada!</p>
              <p className="text-sm">Isso é uma boa notícia - o sistema está funcionando perfeitamente.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Contato</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead>Método</TableHead>
                    <TableHead>Erro</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {failedSales.map((sale) => {
                    const customerData = sale.metadata.CUSTOMER_CONTACT_DATA;
                    
                    return (
                      <TableRow key={sale.id} className="hover:bg-red-50">
                        <TableCell className="text-sm">
                          {new Date(sale.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {customerData ? (
                            <div>
                              <div className="font-medium flex items-center gap-1">
                                <User className="h-3 w-3 text-gray-500" />
                                {customerData.name}
                              </div>
                              <div className="text-xs text-gray-500">
                                CPF: {formatCPF(customerData.cpf)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Dados não disponíveis</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {customerData ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-1 text-sm">
                                <Mail className="h-3 w-3 text-gray-500" />
                                {customerData.email}
                              </div>
                              <div className="flex items-center gap-1 text-sm">
                                <Phone className="h-3 w-3 text-gray-500" />
                                {formatWhatsapp(customerData.whatsapp)}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">N/A</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Package className="h-3 w-3 text-gray-500" />
                            <span className="text-sm">
                              {customerData?.productIds?.length || 0} produto(s)
                            </span>
                          </div>
                          {customerData?.coupon_code && (
                            <Badge variant="outline" className="mt-1 text-xs">
                              Cupom: {customerData.coupon_code}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={
                            sale.metadata.paymentMethod === 'PIX' 
                              ? "bg-blue-100 text-blue-800" 
                              : "bg-green-100 text-green-800"
                          }>
                            {sale.metadata.paymentMethod || 'N/A'}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-xs text-red-600 truncate" title={sale.metadata.errorMessage}>
                            {sale.metadata.errorMessage || sale.message}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex gap-1 justify-center">
                            {customerData && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => copyContactInfo(customerData)}
                                  className="text-blue-600 hover:text-blue-800"
                                  title="Copiar dados de contato"
                                >
                                  <Mail className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRecoverSale(sale)}
                                  disabled={recovering === sale.id}
                                  className="text-green-600 hover:text-green-800"
                                  title="Recuperar venda"
                                >
                                  {recovering === sale.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <RefreshCw className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instruções */}
      <Card className="bg-yellow-50 border-yellow-200">
        <CardHeader>
          <CardTitle className="text-lg text-yellow-800 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Como Recuperar Vendas Perdidas
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-yellow-700 space-y-2">
          <p><strong>1. Copiar Dados:</strong> Use o botão de email para copiar os dados de contato do cliente.</p>
          <p><strong>2. Contato Manual:</strong> Entre em contato via WhatsApp para confirmar a intenção de compra.</p>
          <p><strong>3. Recuperar Venda:</strong> Use o botão de recuperação para criar o pedido manualmente.</p>
          <p><strong>4. Processar Pagamento:</strong> Após recuperar, processe o pagamento normalmente.</p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FailedSales;
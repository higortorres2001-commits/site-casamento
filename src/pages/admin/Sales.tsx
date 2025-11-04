"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Users, 
  Calendar,
  Search,
  Download,
  Eye
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";

type Order = {
  id: string;
  created_at: string;
  user_id: string;
  ordered_product_ids: string[];
  total_price: number;
  status: 'pending' | 'paid' | 'cancelled';
  asaas_payment_id: string | null;
  meta_tracking_data: any;
  profiles?: {
    id: string;
    name: string | null;
    email: string | null;
    cpf: string | null;
    whatsapp: string | null;
  };
  products?: {
    id: string;
    name: string;
    price: number;
  }[];
};

const Sales = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("30d");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const isAdmin = user?.email === "higor.torres8@gmail.com";

  const fetchOrders = useCallback(async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    try {
      // Primeiro, buscar todos os pedidos
      let ordersQuery = supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      // Aplicar filtros
      if (statusFilter !== "all") {
        ordersQuery = ordersQuery.eq("status", statusFilter);
      }

      if (dateFilter !== "all") {
        const now = new Date();
        let cutoff = new Date();
        
        switch (dateFilter) {
          case "7d":
            cutoff.setDate(now.getDate() - 7);
            break;
          case "30d":
            cutoff.setDate(now.getDate() - 30);
            break;
          case "90d":
            cutoff.setDate(now.getDate() - 90);
            break;
        }
        
        if (dateFilter !== "all") {
          ordersQuery = ordersQuery.gte("created_at", cutoff.toISOString());
        }
      }

      const { data: ordersData, error: ordersError } = await ordersQuery.limit(1000);

      if (ordersError) {
        showError("Erro ao carregar vendas: " + ordersError.message);
        console.error("Error fetching orders:", ordersError);
        setOrders([]);
        return;
      }

      // Se não houver pedidos, retornar array vazio
      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      // Buscar perfis separadamente para cada pedido
      const userIds = [...new Set(ordersData.map(order => order.user_id))];
      
      if (userIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, name, email, cpf, whatsapp")
          .in("id", userIds);

        if (profilesError) {
          console.error("Error fetching profiles:", profilesError);
        }

        // Criar mapa de perfis para acesso rápido
        const profilesMap = new Map();
        if (profilesData) {
          profilesData.forEach(profile => {
            profilesMap.set(profile.id, profile);
          });
        }

        // Combinar pedidos com perfis
        const ordersWithProfiles = ordersData.map(order => ({
          ...order,
          profiles: profilesMap.get(order.user_id) || null
        }));

        // Buscar detalhes dos produtos para cada pedido
        const ordersWithProducts = await Promise.all(
          ordersWithProfiles.map(async (order: Order) => {
            if (order.ordered_product_ids && order.ordered_product_ids.length > 0) {
              const { data: products, error: productsError } = await supabase
                .from("products")
                .select("id, name, price")
                .in("id", order.ordered_product_ids);

              if (!productsError && products) {
                return { ...order, products };
              }
            }
            return order;
          })
        );

        setOrders(ordersWithProducts);
      } else {
        setOrders(ordersData);
      }
    } catch (error: any) {
      showError("Erro inesperado ao carregar vendas: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, statusFilter, dateFilter]);

  useEffect(() => {
    if (!isSessionLoading && isAdmin) {
      fetchOrders();
    }
  }, [isSessionLoading, isAdmin, fetchOrders]);

  // Calcular estatísticas
  const statistics = useMemo(() => {
    const totalOrders = orders.length;
    const paidOrders = orders.filter(o => o.status === 'paid').length;
    const pendingOrders = orders.filter(o => o.status === 'pending').length;
    const cancelledOrders = orders.filter(o => o.status === 'cancelled').length;
    
    const totalRevenue = orders
      .filter(o => o.status === 'paid')
      .reduce((sum, order) => sum + Number(order.total_price), 0);
    
    const averageTicket = paidOrders > 0 ? totalRevenue / paidOrders : 0;

    // Comparação com período anterior (simplificado)
    const previousPeriodRevenue = totalRevenue * 0.8; // Simulação
    const revenueGrowth = previousPeriodRevenue > 0 
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100 
      : 0;

    return {
      totalOrders,
      paidOrders,
      pendingOrders,
      cancelledOrders,
      totalRevenue,
      averageTicket,
      revenueGrowth
    };
  }, [orders]);

  // Filtrar pedidos
  const filteredOrders = useMemo(() => {
    if (!searchTerm.trim()) return orders;

    const term = searchTerm.toLowerCase();
    return orders.filter(order => 
      order.profiles?.name?.toLowerCase().includes(term) ||
      order.profiles?.email?.toLowerCase().includes(term) ||
      order.profiles?.cpf?.includes(term) ||
      order.id.toLowerCase().includes(term) ||
      order.products?.some(p => p.name.toLowerCase().includes(term))
    );
  }, [orders, searchTerm]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setIsModalOpen(true);
  };

  const exportSales = () => {
    const csvContent = [
      ["Data", "ID do Pedido", "ID do Cliente", "Cliente", "Email", "Status", "Produtos", "Total"].join(","),
      ...filteredOrders.map(order => [
        new Date(order.created_at).toLocaleString(),
        order.id,
        order.profiles?.id || "",
        `"${order.profiles?.name || ''}"`,
        `"${order.profiles?.email || ''}"`,
        order.status,
        `"${order.products?.map(p => p.name).join("; ") || ''}"`,
        order.total_price
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vendas-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess("Relatório de vendas exportado com sucesso!");
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
          <h1 className="text-3xl font-bold">Vendas</h1>
          <p className="text-gray-500">Gerencie e visualize todas as vendas</p>
        </div>
        <Button onClick={exportSales} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Vendas</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statistics.totalOrders}</div>
            <p className="text-xs text-muted-foreground">
              {statistics.paidOrders} pagas • {statistics.pendingOrders} pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground flex items-center">
              {statistics.revenueGrowth >= 0 ? (
                <>
                  <TrendingUp className="h-3 w-3 mr-1 text-green-500" />
                  <span className="text-green-500">
                    +{statistics.revenueGrowth.toFixed(1)}%
                  </span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-3 w-3 mr-1 text-red-500" />
                  <span className="text-red-500">
                    {statistics.revenueGrowth.toFixed(1)}%
                  </span>
                </>
              )}
              vs período anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(statistics.averageTicket)}</div>
            <p className="text-xs text-muted-foreground">
              Por venda concluída
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Conversão</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statistics.totalOrders > 0 
                ? ((statistics.paidOrders / statistics.totalOrders) * 100).toFixed(1)
                : "0"
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Vendas concluídas / total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Cliente, email, produto..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os status</SelectItem>
                  <SelectItem value="paid">Pagos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="cancelled">Cancelados</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todo o período</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchOrders} className="w-full">
                <Search className="h-4 w-4 mr-2" />
                Aplicar Filtros
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Vendas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Pedidos ({filteredOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>ID do Pedido</TableHead>
                    <TableHead>ID do Cliente</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Produtos</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOrders.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                        Nenhuma venda encontrada com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOrders.map((order) => (
                      <TableRow key={order.id} className="hover:bg-gray-50">
                        <TableCell className="text-sm">
                          {new Date(order.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {order.id.substring(0, 8)}
                        </TableCell>
                        <TableCell className="text-sm font-mono">
                          {order.profiles?.id?.substring(0, 8) || "N/A"}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-sm">
                              {order.profiles?.name || "Cliente não identificado"}
                            </div>
                            <div className="text-xs text-gray-500">
                              {order.profiles?.email || ""}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(order.status)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="text-sm truncate" title={order.products?.map(p => p.name).join(", ")}>
                            {order.products?.map(p => p.name).join(", ") || "N/A"}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(order.total_price))}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openOrderDetails(order)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes do Pedido */}
      {selectedOrder && (
        <Card className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold">Detalhes do Pedido</h3>
                <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                  ×
                </Button>
              </div>

              <div className="space-y-6">
                {/* Informações do Cliente */}
                <div>
                  <h4 className="font-semibold mb-2">Informações do Cliente</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">ID:</span>
                      <p className="font-medium font-mono">{selectedOrder.profiles?.id || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Nome:</span>
                      <p className="font-medium">{selectedOrder.profiles?.name || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium">{selectedOrder.profiles?.email || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">CPF:</span>
                      <p className="font-medium">
                        {selectedOrder.profiles?.cpf ? formatCPF(selectedOrder.profiles.cpf) : "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">WhatsApp:</span>
                      <p className="font-medium">
                        {selectedOrder.profiles?.whatsapp ? formatWhatsapp(selectedOrder.profiles.whatsapp) : "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Informações do Pedido */}
                <div>
                  <h4 className="font-semibold mb-2">Informações do Pedido</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">ID do Pedido:</span>
                      <p className="font-medium font-mono">{selectedOrder.id}</p>
                    </div>
                    <div>
                      <span className="text-gray-600">Data:</span>
                      <p className="font-medium">
                        {new Date(selectedOrder.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600">Status:</span>
                      <div className="mt-1">{getStatusBadge(selectedOrder.status)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Total:</span>
                      <p className="font-medium text-lg">
                        {formatCurrency(Number(selectedOrder.total_price))}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Produtos */}
                <div>
                  <h4 className="font-semibold mb-2">Produtos</h4>
                  <div className="space-y-2">
                    {selectedOrder.products?.map((product, index) => (
                      <div key={product.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-gray-600">ID: {product.id}</p>
                        </div>
                        <p className="font-medium">
                          {formatCurrency(Number(product.price))}
                        </p>
                      </div>
                    )) || (
                      <p className="text-gray-500">Nenhum produto encontrado</p>
                    )}
                  </div>
                </div>

                {/* Metadados de Rastreamento */}
                {selectedOrder.meta_tracking_data && (
                  <div>
                    <h4 className="font-semibold mb-2">Metadados de Rastreamento</h4>
                    <div className="bg-gray-900 rounded p-3 overflow-x-auto">
                      <pre className="text-xs text-green-400">
                        {JSON.stringify(selectedOrder.meta_tracking_data, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default Sales;
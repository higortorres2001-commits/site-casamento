"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  Users,
  Clock,
  Mail,
  Phone,
  Search,
  PencilLine,
  UserPlus,
  Database,
  Trash2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import CreateCustomerForm from "@/components/admin/CreateCustomerForm";
import MassAccessModal from "@/components/admin/MassAccessModal";
import CustomerEditorModal from "@/components/admin/CustomerEditorModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";
import { showError, showSuccess } from "@/utils/toast";
import { useDebouncedCallback } from "use-debounce";

type CustomerSummary = {
  id: string;
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  whatsapp?: string | null;
  access: string[];
  is_admin?: boolean;
};

type OrderSnapshot = {
  id: string;
  user_id: string;
  status: string;
  total_price: number;
  created_at: string;
};

type CustomerRow = CustomerSummary & {
  lastOrder?: OrderSnapshot;
};

type PaginationData = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

const paymentLabels: Record<string, { label: string; className: string }> = {
  paid: {
    label: "Pago",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
  },
  pending: {
    label: "Pendente",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
  },
};

const formatCurrencyBRL = (value?: number | null) => {
  if (value === undefined || value === null) {
    return "—";
  }
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
};

const PAGE_SIZE = 20;

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMassModalOpen, setIsMassModalOpen] = useState(false);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    pageSize: PAGE_SIZE,
    total: 0,
    totalPages: 0,
  });

  // Editor individual
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  // Debounce search term
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const fetchCustomers = useCallback(async (page: number = 1, search: string = "") => {
    setLoading(true);
    try {
      // Calculate range for pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access, is_admin, created_at")
        .order("created_at", { ascending: false });

      // Apply server-side search if provided
      if (search.trim()) {
        query = query.or(
          `name.ilike.%${search}%,email.ilike.%${search}%,cpf.ilike.%${search}%,whatsapp.ilike.%${search}%`
        );
      }

      // Apply pagination
      query = query.range(from, to);

      const { data: profiles, error: profileError, count } = await query;

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        showError("Erro ao carregar perfis dos usuários.");
        setCustomers([]);
        setPagination({
          page: 1,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        });
        return;
      }

      console.log(`Fetched ${profiles?.length || 0} profiles from database (page ${page})`);

      if (!profiles || profiles.length === 0) {
        setCustomers([]);
        setPagination({
          page: 1,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        });
        return;
      }

      // Get all user IDs for orders query
      const userIds = profiles.map(profile => profile.id);

      // Fetch last order for each user
      const orderMap: Record<string, OrderSnapshot> = {};
      if (userIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, user_id, status, total_price, created_at")
          .in("user_id", userIds)
          .order("created_at", { ascending: false });

        if (ordersError) {
          console.error("Error fetching orders:", ordersError);
        } else if (ordersData) {
          for (const order of ordersData) {
            if (!orderMap[order.user_id]) {
              orderMap[order.user_id] = {
                id: order.id,
                user_id: order.user_id,
                status: order.status,
                total_price: Number(order.total_price ?? 0),
                created_at: order.created_at,
              };
            }
          }
        }
      }

      // Map profiles to customer rows
      const customersWithOrders: CustomerRow[] = profiles.map(profile => {
        return {
          id: profile.id,
          name: profile.name || null,
          email: profile.email || null,
          cpf: profile.cpf || null,
          whatsapp: profile.whatsapp || null,
          access: Array.isArray(profile.access) ? profile.access : [],
          is_admin: profile.is_admin || false,
          lastOrder: orderMap[profile.id],
        };
      });

      setCustomers(customersWithOrders);
      
      // Update pagination
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      
      setPagination({
        page,
        pageSize: PAGE_SIZE,
        total: totalCount,
        totalPages,
      });

      showSuccess(`${customersWithOrders.length} clientes carregados com sucesso!`);
    } catch (error: any) {
      console.error("Unexpected error fetching customers:", error);
      showError("Erro inesperado ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching products:", error);
        showError("Erro ao carregar produtos.");
        return [];
      }
      
      console.log(`Fetched ${data?.length || 0} products`);
      return data || [];
    } catch (error: any) {
      console.error("Unexpected error fetching products:", error);
      showError("Erro inesperado ao carregar produtos.");
      return [];
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchCustomers(1, "");
      // Pre-fetch products for faster modal opening
      fetchProducts().then(products => setMassProducts(products));
    }
  }, [isSessionLoading, user, fetchCustomers, fetchProducts]);

  // Load data when page or search changes
  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchCustomers(pagination.page, debouncedSearchTerm);
    }
  }, [pagination.page, debouncedSearchTerm, isSessionLoading, user, fetchCustomers]);

  const handleCreateCustomer = () => {
    setIsCreateModalOpen(true);
  };

  const handleCustomerCreated = () => {
    setIsCreateModalOpen(false);
    fetchCustomers(pagination.page, debouncedSearchTerm);
  };

  const handleOpenMassAccess = async () => {
    // Refresh products list before opening modal
    const products = await fetchProducts();
    setMassProducts(products);
    setIsMassModalOpen(true);
  };

  const handleApplyMassAccess = async (productIds: string[], customerIds: string[]) => {
    if (!productIds.length || !customerIds.length) return;

    setLoading(true);
    try {
      // Call secure backend function
      const { data, error } = await supabase.functions.invoke("admin-apply-mass-access", {
        body: { productIds, customerIds },
      });

      if (error) {
        showError("Erro ao aplicar acesso dos clientes: " + error.message);
        console.error("Error applying mass access:", error);
        return;
      }

      if (data?.error) {
        showError(data.error);
        return;
      }

      showSuccess(`Acesso concedido para ${data.updatedCount} cliente(s) com sucesso!`);
      fetchCustomers(pagination.page, debouncedSearchTerm);
    } catch (error: any) {
      console.error("Unexpected error applying mass access:", error);
      showError("Erro inesperado ao aplicar acesso em massa.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = async (customer: CustomerRow) => {
    // Refresh products list before opening modal
    const products = await fetchProducts();
    setMassProducts(products);
    setEditingCustomer(customer);
    setIsEditorOpen(true);
  };

  const handleDeleteCustomer = async (customer: CustomerRow) => {
    if (!window.confirm(
      `Tem certeza que deseja apagar o usuário "${customer.name || customer.email}"? Esta ação é irreversível e removerá:\n\n• A conta de autenticação\n• O perfil do usuário\n• Todos os dados associados`
    )) {
      return;
    }

    setLoading(true);
    
    try {
      // Call secure backend function
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { userId: customer.id },
      });

      if (error) {
        showError("Erro ao apagar usuário: " + error.message);
        console.error("Error deleting user:", error);
        return;
      }

      if (data?.error) {
        showError(data.error);
        return;
      }

      showSuccess(`Usuário "${customer.name || customer.email}" apagado com sucesso!`);
      fetchCustomers(pagination.page, debouncedSearchTerm);
    } catch (error: any) {
      console.error("Unexpected error deleting user:", error);
      showError("Erro inesperado ao apagar usuário.");
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <div className="container mx-auto flex flex-col gap-6 p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
          <p className="text-gray-500">Gerencie usuários e seus acessos aos produtos</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={handleCreateCustomer}
          >
            <UserPlus className="h-4 w-4 mr-2" /> Novo Cliente
          </Button>
          <Button
            variant="outline"
            onClick={handleOpenMassAccess}
            disabled={customers.length === 0}
          >
            <Database className="h-4 w-4 mr-2" /> Acesso em Massa
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Clientes ({pagination.total})</span>
              </div>
              {pagination.total > PAGE_SIZE && (
                <div className="text-sm text-gray-500">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
              )}
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => handleSearchChange(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              {debouncedSearchTerm ? "Nenhum cliente encontrado com os critérios de busca." : "Nenhum cliente cadastrado."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Acesso</TableHead>
                      <TableHead>Último Pedido</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => (
                      <TableRow key={customer.id}>
                        <TableCell>
                          <div className="font-medium">{customer.name || "—"}</div>
                          <div className="text-sm text-gray-500">
                            {customer.cpf ? formatCPF(customer.cpf) : "—"}
                          </div>
                          {customer.is_admin && (
                            <Badge variant="outline" className="mt-1 bg-blue-50 text-blue-700 border-blue-200">
                              Admin
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-gray-500" />
                            <span className="text-sm">{customer.email || "—"}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                            <Phone className="h-3 w-3 text-gray-500" />
                            <span className="text-sm">
                              {customer.whatsapp ? formatWhatsapp(customer.whatsapp) : "—"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {customer.access && customer.access.length > 0 ? (
                              <Badge className="bg-green-100 text-green-700 border-green-200">
                                {customer.access.length} produto(s)
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-gray-500">
                                Sem acesso
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {customer.lastOrder ? (
                            <div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-gray-500" />
                                <span className="text-sm">
                                  {new Date(customer.lastOrder.created_at).toLocaleDateString()}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 mt-1">
                                <Badge
                                  className={
                                    paymentLabels[customer.lastOrder.status]?.className ||
                                    "bg-gray-100 text-gray-700"
                                  }
                                >
                                  {paymentLabels[customer.lastOrder.status]?.label ||
                                    customer.lastOrder.status}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {formatCurrencyBRL(customer.lastOrder.total_price)}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-sm">Nenhum pedido</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                            >
                              <PencilLine className="h-4 w-4 mr-1" /> Editar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteCustomer(customer)}
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              disabled={loading}
                            >
                              <Trash2 className="h-4 w-4 mr-1" /> Apagar
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination Controls */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-4 border-t">
                  <div className="text-sm text-gray-600">
                    Mostrando {customers.length} de {pagination.total} clientes
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page <= 1 || loading}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Anterior
                    </Button>
                    <span className="text-sm text-gray-600">
                      Página {pagination.page} de {pagination.totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={pagination.page >= pagination.totalPages || loading}
                    >
                      Próxima
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de criação de cliente */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Cliente</DialogTitle>
          </DialogHeader>
          <CreateCustomerForm onCreated={handleCustomerCreated} />
        </DialogContent>
      </Dialog>

      {/* Modal de acesso em massa */}
      <MassAccessModal
        open={isMassModalOpen}
        onClose={() => setIsMassModalOpen(false)}
        customers={customers}
        products={massProducts}
        onApply={handleApplyMassAccess}
      />

      {/* Modal de edição de cliente */}
      {editingCustomer && (
        <CustomerEditorModal
          open={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          customer={editingCustomer}
          products={massProducts}
          onRefresh={() => fetchCustomers(pagination.page, debouncedSearchTerm)}
        />
      )}
    </div>
  );
};

export default Customers;
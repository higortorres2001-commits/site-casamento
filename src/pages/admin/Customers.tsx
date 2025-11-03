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
  CheckCircle2,
  AlertCircle,
  Mail,
  Phone,
  Search,
  PencilLine,
  Plus,
  UserPlus,
  Database,
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

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMassModalOpen, setIsMassModalOpen] = useState(false);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Editor individual
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  const fetchAllAuthUsers = async () => {
    const allUsers: any[] = [];
    let page = 1;
    const perPage = 1000; // Maximum allowed by Supabase
    
    try {
      while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
          page,
          perPage,
        });

        if (error) {
          console.error(`Error fetching users page ${page}:`, error);
          throw error;
        }

        if (!data || !data.users || data.users.length === 0) {
          break;
        }

        allUsers.push(...data.users);
        
        // If we got fewer users than perPage, we've reached the end
        if (data.users.length < perPage) {
          break;
        }
        
        page++;
      }
      
      console.log(`Successfully fetched ${allUsers.length} total users from auth`);
      return allUsers;
    } catch (error) {
      console.error('Error in fetchAllAuthUsers:', error);
      throw error;
    }
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all users from auth.users with pagination
      const authUsers = await fetchAllAuthUsers();

      console.log(`Fetched ${authUsers.length} users from auth`);

      // Fetch profiles for these users
      const userIds = authUsers.map(user => user.id);
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access, is_admin")
        .in("id", userIds);

      if (profileError) {
        console.error("Error fetching profiles:", profileError);
        showError("Erro ao carregar perfis dos usuários.");
        setCustomers([]);
        setLoading(false);
        return;
      }

      console.log(`Fetched ${profiles?.length || 0} profiles from database`);

      // Create a map of profiles by user ID for quick lookup
      const profileMap: Record<string, any> = {};
      (profiles || []).forEach(profile => {
        profileMap[profile.id] = profile;
      });

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

      // Combine auth users with profiles and orders
      const customersWithOrders: CustomerRow[] = authUsers.map(authUser => {
        const profile = profileMap[authUser.id] || {};
        return {
          id: authUser.id,
          name: profile.name || authUser.user_metadata?.name || null,
          email: profile.email || authUser.email || null,
          cpf: profile.cpf || authUser.user_metadata?.cpf || null,
          whatsapp: profile.whatsapp || authUser.user_metadata?.whatsapp || null,
          access: Array.isArray(profile.access) ? profile.access : [],
          is_admin: profile.is_admin || false,
          lastOrder: orderMap[authUser.id],
        };
      });

      setCustomers(customersWithOrders);
      showSuccess(`${customersWithOrders.length} clientes carregados com sucesso!`);
    } catch (error) {
      console.error("Unexpected error fetching customers:", error);
      showError("Erro inesperado ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("id, name")
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching products:", error);
      return [];
    }
    return data || [];
  }, []);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchCustomers();
    }
  }, [isSessionLoading, user, fetchCustomers]);

  const handleCreateCustomer = () => {
    setIsCreateModalOpen(true);
  };

  const handleCustomerCreated = () => {
    setIsCreateModalOpen(false);
    fetchCustomers();
  };

  const handleOpenMassAccess = async () => {
    const products = await fetchProducts();
    setMassProducts(products);
    setIsMassModalOpen(true);
  };

  const handleApplyMassAccess = async (productIds: string[], customerIds: string[]) => {
    if (!productIds.length || !customerIds.length) return;

    setLoading(true);
    try {
      // Fetch current access for each customer
      const { data: profiles, error: fetchError } = await supabase
        .from("profiles")
        .select("id, access")
        .in("id", customerIds);

      if (fetchError) {
        showError("Erro ao buscar perfis dos clientes.");
        console.error("Error fetching profiles:", fetchError);
        return;
      }

      // Update each profile with new access
      const updates = profiles.map(profile => {
        const currentAccess = Array.isArray(profile.access) ? profile.access : [];
        const newAccess = [...new Set([...currentAccess, ...productIds])];
        return {
          id: profile.id,
          access: newAccess,
        };
      });

      const { error: updateError } = await supabase.from("profiles").upsert(updates);

      if (updateError) {
        showError("Erro ao atualizar acesso dos clientes.");
        console.error("Error updating profiles:", updateError);
        return;
      }

      showSuccess(`Acesso concedido para ${customerIds.length} cliente(s).`);
      fetchCustomers();
    } catch (error) {
      console.error("Unexpected error applying mass access:", error);
      showError("Erro inesperado ao aplicar acesso em massa.");
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setIsEditorOpen(true);
  };

  const filteredCustomers = useMemo(() => {
    if (!searchTerm.trim()) return customers;

    const term = searchTerm.toLowerCase().trim();
    return customers.filter(
      (customer) =>
        customer.name?.toLowerCase().includes(term) ||
        customer.email?.toLowerCase().includes(term) ||
        customer.cpf?.includes(term) ||
        customer.whatsapp?.includes(term)
    );
  }, [customers, searchTerm]);

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                <span>Clientes ({filteredCustomers.length})</span>
              </div>
            </CardTitle>
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar cliente..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              {searchTerm ? "Nenhum cliente encontrado com os critérios de busca." : "Nenhum cliente cadastrado."}
            </div>
          ) : (
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
                  {filteredCustomers.map((customer) => (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditCustomer(customer)}
                          className="text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <PencilLine className="h-4 w-4 mr-1" /> Editar
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
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
          onRefresh={fetchCustomers}
        />
      )}
    </div>
  );
};

export default Customers;
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

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access");

      if (profileError || !profiles) {
        console.error("Error fetching customers:", profileError);
        setCustomers([]);
        return;
      }

      const profileIds = profiles.map((profile) => profile.id);

      const orderMap: Record<string, OrderSnapshot> = {};

      if (profileIds.length > 0) {
        const { data: ordersData, error: ordersError } = await supabase
          .from("orders")
          .select("id, user_id, status, total_price, created_at")
          .in("user_id", profileIds)
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

      const customersWithOrders: CustomerRow[] =
        profiles.map((profile) => ({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          cpf: profile.cpf,
          whatsapp: profile.whatsapp,
          access: Array.isArray(profile.access) ? profile.access : [],
          lastOrder: orderMap[profile.id],
        })) ?? [];

      setCustomers(customersWithOrders);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("id, name");
    if (error) {
      console.error("Error fetching products for mass access modal:", error);
      setMassProducts([]);
    } else {
      setMassProducts(data ?? []);
    }
  }, []);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchCustomers();
      fetchProducts();
    }
  }, [isSessionLoading, user, fetchCustomers, fetchProducts]);

  const handleMassApply = useCallback(
    async (productIds: string[], customerIds: string[]) => {
      if (productIds.length === 0 || customerIds.length === 0) return;

      await Promise.all(
        customerIds.map(async (customerId) => {
          const { data: profileData, error: profileError } = await supabase
            .from("profiles")
            .select("access")
            .eq("id", customerId)
            .single();

          if (profileError) throw profileError;

          const existingAccess = Array.isArray(profileData?.access)
            ? profileData.access
            : [];

          const updatedAccess = Array.from(new Set([...existingAccess, ...productIds]));

          const { error: updateError } = await supabase
            .from("profiles")
            .update({ access: updatedAccess })
            .eq("id", customerId);

          if (updateError) throw updateError;
        })
      );

      await fetchCustomers();
      showSuccess("Acesso aplicado com sucesso!");
    },
    [fetchCustomers]
  );

  const handleCustomerCreated = useCallback(() => {
    setIsCreateModalOpen(false);
    fetchCustomers();
  }, [fetchCustomers]);

  // Abrir editor individual
  const openEditor = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingCustomer(null);
  };

  const saveCustomerEdits = async (payload: { id: string; name?: string; email?: string; access?: string[] | null }) => {
    if (!payload?.id) return;
    const { error } = await supabase
      .from("profiles")
      .update({
        name: payload.name ?? null,
        email: payload.email ?? null,
        access: payload.access ?? [],
      })
      .eq("id", payload.id);

    if (error) {
      showError("Erro ao salvar cliente: " + error.message);
      return;
    }

    showSuccess("Cliente salvo com sucesso!");
    await fetchCustomers();
    closeEditor();
  };

  const removeAllAccess = async () => {
    if (!editingCustomer) return;
    const { error } = await supabase
      .from("profiles")
      .update({ access: [] })
      .eq("id", editingCustomer.id);

    if (error) {
      showError("Erro ao remover acessos: " + error.message);
      return;
    }

    showSuccess("Todos os acessos foram removidos!");
    await fetchCustomers();
    closeEditor();
  };

  const filteredCustomers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return [...customers].sort((a, b) =>
        (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")
      );
    }

    return customers
      .filter((customer) => {
        const haystack = [
          customer.name,
          customer.email,
          customer.cpf,
          customer.whatsapp,
          customer.lastOrder?.id,
        ]
          .filter(Boolean)
          .map((value) => value!.toString().toLowerCase());

        return haystack.some((value) => value.includes(term));
      })
      .sort((a, b) =>
        (a.name ?? a.email ?? "").localeCompare(b.name ?? b.email ?? "")
      );
  }, [customers, searchTerm]);

  const stats = useMemo(() => {
    const totalCustomers = customers.length;
    const paidCustomers = customers.filter(
      (customer) => customer.lastOrder?.status === "paid"
    ).length;
    const pendingCustomers = customers.filter(
      (customer) => customer.lastOrder && customer.lastOrder.status !== "paid"
    ).length;
    const noAccessPending = customers.filter(
      (customer) =>
        customer.access.length === 0 &&
        customer.lastOrder &&
        customer.lastOrder.status !== "paid"
    ).length;

    return {
      totalCustomers,
      paidCustomers,
      pendingCustomers,
      noAccessPending,
    };
  }, [customers]);

  const pendingWithoutAccess = useMemo(
    () =>
      customers.filter(
        (customer) =>
          customer.access.length === 0 &&
          customer.lastOrder &&
          customer.lastOrder.status !== "paid"
      ),
    [customers]
  );

  const getPaymentBadge = (status?: string) => {
    if (!status) {
      return (
        <Badge variant="outline" className="border-slate-200 text-slate-600">
          Sem pedidos
        </Badge>
      );
    }

    const normalizedStatus = status.toLowerCase();
    const config = paymentLabels[normalizedStatus];

    if (!config) {
      return (
        <Badge variant="outline" className="border-slate-200 text-slate-600">
          {status}
        </Badge>
      );
    }

    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
      >
        {config.label}
      </span>
    );
  };

  const renderContactInfo = (customer: CustomerRow) => {
    const hasPending =
      customer.lastOrder && customer.lastOrder.status !== "paid" && customer.access.length === 0;

    return (
      <div className="space-y-1">
        {customer.email && (
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Mail className="h-4 w-4 text-slate-400" />
            <span>{customer.email}</span>
          </div>
        )}
        {customer.whatsapp && (
          <div className="flex items-center gap-1 text-sm text-slate-600">
            <Phone className="h-4 w-4 text-slate-400" />
            <span>{formatWhatsapp(customer.whatsapp)}</span>
          </div>
        )}
        {hasPending && (
          <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-700">
            Pedido pendente sem acesso liberado.
          </div>
        )}
      </div>
    );
  };

  const hasCustomers = filteredCustomers.length > 0;

  // Mapa de produtos para validar acessos existentes
  const productIdSet = useMemo(() => new Set(massProducts.map(p => p.id)), [massProducts]);

  return (
    <div className="container mx-auto flex flex-col gap-6 p-4">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Clientes</h1>
          <p className="text-sm text-gray-500">
            Visualize dados, status de pagamento e libere acessos em poucos cliques.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => setIsCreateModalOpen(true)}
          >
            Novo Cliente
          </Button>
          <Button variant="secondary" onClick={() => setIsMassModalOpen(true)}>
            Editar Acesso em Massa
          </Button>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Total de clientes
            </CardTitle>
            <Users className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-slate-900">
              {stats.totalCustomers}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Pedidos pagos
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-emerald-600">
              {stats.paidCustomers}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Pagamentos pendentes
            </CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-amber-600">
              {stats.pendingCustomers}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Pendentes sem acesso
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <span className="text-2xl font-semibold text-rose-600">
              {stats.noAccessPending}
            </span>
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-medium text-slate-600" htmlFor="customer-search">
          Buscar clientes
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            id="customer-search"
            placeholder="Busque por nome, e-mail, CPF ou ID de pedido"
            className="pl-9"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </div>
      </div>

      {pendingWithoutAccess.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-700">
              <AlertCircle className="h-5 w-5" />
              Clientes com pagamento pendente e sem acesso liberado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingWithoutAccess.map((customer) => (
              <div
                key={customer.id}
                className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-white p-3 shadow-sm md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    {customer.name ?? "Cliente sem nome"}
                  </p>
                  <p className="text-xs text-slate-500">{customer.email ?? "Sem e-mail"}</p>
                </div>
                <div className="flex flex-col gap-1 text-xs text-slate-600 md:text-right">
                  {customer.whatsapp && (
                    <span>WhatsApp: {formatWhatsapp(customer.whatsapp)}</span>
                  )}
                  <span>
                    Pedido #{customer.lastOrder?.id?.slice(0, 8)} •{" "}
                    {customer.lastOrder?.created_at
                      ? new Date(customer.lastOrder.created_at).toLocaleDateString("pt-BR")
                      : "Sem data"}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <section className="rounded-xl border border-slate-200 bg-white shadow-lg">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : hasCustomers ? (
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Acessos</TableHead>
                <TableHead>Status de pagamento</TableHead>
                <TableHead>Último pedido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer) => {
                // Contar apenas acessos que existem na lista de produtos atual
                const validAccessCount = (customer.access ?? []).filter(id => productIdSet.has(id)).length;

                return (
                  <TableRow key={customer.id} className="hover:bg-slate-50">
                    <TableCell className="font-semibold text-slate-900">
                      <div className="flex flex-col">
                        <span>{customer.name ?? "Cliente sem nome"}</span>
                        <span className="text-xs text-slate-400">ID: {customer.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>{renderContactInfo(customer)}</TableCell>
                    <TableCell>
                      {customer.cpf ? (
                        <span className="text-sm text-slate-700">
                          {formatCPF(customer.cpf)}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">Não informado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {validAccessCount > 0 ? (
                        <Badge variant="secondary">
                          {validAccessCount} produto(s)
                        </Badge>
                      ) : (
                        <span className="text-sm text-slate-500">Nenhum acesso</span>
                      )}
                    </TableCell>
                    <TableCell>{getPaymentBadge(customer.lastOrder?.status)}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {customer.lastOrder ? (
                        <div className="space-y-1">
                          <p>
                            {new Date(customer.lastOrder.created_at).toLocaleDateString("pt-BR")}
                          </p>
                          <p className="text-xs text-slate-400">
                            {formatCurrencyBRL(customer.lastOrder.total_price)}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-400">Sem pedidos</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-700 hover:text-orange-600"
                        onClick={() => openEditor(customer)}
                        title="Editar cliente e acessos"
                      >
                        <PencilLine className="h-4 w-4 mr-1" />
                        Editar
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12">
            <AlertCircle className="h-10 w-10 text-slate-300" />
            <p className="text-sm text-slate-500">
              Nenhum cliente encontrado com os filtros aplicados.
            </p>
          </div>
        )}
      </section>

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar novo cliente manualmente</DialogTitle>
          </DialogHeader>
          <CreateCustomerForm onCreated={handleCustomerCreated} />
        </DialogContent>
      </Dialog>

      <MassAccessModal
        open={isMassModalOpen}
        onClose={() => setIsMassModalOpen(false)}
        customers={customers.map(({ id, name, email }) => ({
          id,
          name: name ?? undefined,
          email: email ?? undefined,
        }))}
        products={massProducts}
        onApply={handleMassApply}
      />

      {editingCustomer && (
        <CustomerEditorModal
          open={isEditorOpen}
          onClose={closeEditor}
          customer={{
            id: editingCustomer.id,
            name: editingCustomer.name,
            email: editingCustomer.email,
            access: editingCustomer.access,
          }}
          products={massProducts}
          onSave={saveCustomerEdits}
          onRemoveAccess={removeAllAccess}
        />
      )}
    </div>
  );
};

export default Customers;
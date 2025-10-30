"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import CustomerEditorModal from "@/components/admin/CustomerEditorModal";
import MassAccessModal from "@/components/admin/MassAccessModal";
import { supabase } from "@/integrations/supabase/client";
import { Profile } from "@/types";
import { showError, showSuccess } from "@/utils/toast";

type CustomerRow = Profile & { access?: string[] | null };

const Customers = () => {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  const [isMassOpen, setIsMassOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<{ id: string; name: string }[]>([]);

  // Fetch customers (from profiles) and products
  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from("profiles")
        .select("id, name, email, access")
        .order("name", { ascending: true });
      const list = (data || []) as CustomerRow[];
      setCustomers(list);
      // Reset selections on refresh
      setSelectedIds([]);
      setSelectAll(false);
    } catch (e) {
      showError("Falha ao carregar clientes.");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const { data } = await supabase.from("products").select("id, name").order("name", { ascending: true });
      setAllProducts(data?.map((p) => ({ id: p.id, name: p.name })) ?? []);
    } catch (e) {
      showError("Falha ao carregar produtos.");
      console.error(e);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedIds([]);
      setSelectAll(false);
    } else {
      const ids = customers.map((c) => c.id);
      setSelectedIds(ids);
      setSelectAll(true);
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const openEditor = (customer: CustomerRow) => {
    setEditingCustomer(customer);
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setEditingCustomer(null);
  };

  const saveCustomer = async (payload: { id: string; name?: string; email?: string; access?: string[] | null; }) => {
    const { id, name, email, access } = payload;
    try {
      const { error } = await supabase.from("profiles").update({ name, email, access }).eq("id", id);
      if (error) {
        showError("Erro ao salvar cliente: " + error.message);
        return;
      }
      showSuccess("Cliente salvo com sucesso!");
      fetchCustomers();
      closeEditor();
    } catch (err) {
      showError("Erro ao salvar cliente.");
      console.error(err);
    }
  };

  const removeAllAccess = async (customerId: string) => {
    const { error } = await supabase.from("profiles").update({ access: [] }).eq("id", customerId);
    if (error) {
      showError("Erro ao remover acessos: " + error.message);
    } else {
      showSuccess("Acessos removidos com sucesso!");
      fetchCustomers();
    }
  };

  const applyMassAccess = async (productIds: string[]) => {
    if (selectedIds.length === 0) {
      showError("Selecione pelo menos um cliente para aplicar o acesso em massa.");
      return;
    }
    if (productIds.length === 0) {
      showError("Selecione pelo menos um product para conceder acesso.");
      return;
    }

    // Build updates in parallel
    const updates = selectedIds.map(async (cid) => {
      const c = customers.find((cu) => cu.id === cid);
      const existing = c?.access ?? [];
      const newAccess = Array.from(new Set([...existing, ...productIds]));
      const { error } = await supabase.from("profiles").update({ access: newAccess }).eq("id", cid);
      return { cid, error };
    });

    const results = await Promise.all(updates);
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      showError("Erro ao aplicar acesso em massa para alguns clientes.");
      console.error(errors);
    } else {
      showSuccess("Acesso aplicado com sucesso para os clientes selecionados!");
    }
    fetchCustomers();
    setIsMassOpen(false);
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsMassOpen(true)} disabled={customers.length === 0}>
            Acesso em Massa
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input type="checkbox" checked={selectAll} onChange={toggleSelectAll} aria-label="Selecionar todos" />
                </TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Acessos</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(c.id)}
                      onChange={() => toggleSelectOne(c.id)}
                    />
                  </TableCell>
                  <TableCell className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold">
                      {c.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <div className="font-medium">{c.name ?? "Sem nome"}</div>
                      <div className="text-xs text-gray-500">{c.id}</div>
                    </div>
                  </TableCell>
                  <TableCell>{c.email ?? "sem email"}</TableCell>
                  <TableCell>{(c.access?.length ?? 0)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditor(c)} className="mr-2" title="Editar">
                      <span className="material-icons" aria-hidden>edit</span> {/* simple edit feel */}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeAllAccess(c.id)} title="Remover acessos">
                      ✖
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerEditorModal
        open={isEditorOpen}
        onClose={closeEditor}
        customer={editingCustomer}
        products={allProducts}
        onSave={saveCustomer}
        onRemoveAccess={() => editingCustomer && removeAllAccess(editingCustomer.id)}
      />

      <MassAccessModal
        open={isMassOpen}
        onClose={() => setIsMassOpen(false)}
        customers={customers}
        products={allProducts}
        onApply={applyMassAccess}
      />
    </div>
  );
};

export default Customers;
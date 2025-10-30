"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import CreateCustomerForm from "@/components/admin/CreateCustomerForm";
import MassAccessModal from "@/components/admin/MassAccessModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";
import { Badge } from "@/components/ui/badge";

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMassModalOpen, setIsMassModalOpen] = useState(false);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access");
      if (error) {
        console.error("Error fetching customers:", error);
      } else {
        const list = (data || []).map((c: any) => ({
          id: c.id,
          name: c.name,
          email: c.email,
          cpf: c.cpf,
          whatsapp: c.whatsapp,
          access: c.access || [],
        }));
        setCustomers(list);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase.from("products").select("id, name");
    if (error) {
      console.error("Error fetching products for mass edit:", error);
    } else {
      setMassProducts(data || []);
    }
  }, []);

  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchCustomers();
      fetchProducts();
    }
  }, [isSessionLoading, user, fetchCustomers, fetchProducts]);

  const handleMassApply = async (productIds: string[], customerIds: string[]) => {
    if (productIds.length === 0 || customerIds.length === 0) return;

    await Promise.all(
      customerIds.map(async (cid) => {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("access")
          .eq("id", cid)
          .single();

        if (profileError) throw profileError;

        const existing = Array.isArray(profileData?.access) ? profileData.access : [];
        const merged = Array.from(new Set([...existing, ...productIds]));

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ access: merged })
          .eq("id", cid);

        if (updateError) throw updateError;
      })
    );

    await fetchCustomers();
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isSelected = (id: string) => selectedCustomerIds.includes(id);

  const handleCustomerCreated = () => {
    setIsCreateModalOpen(false);
    fetchCustomers();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
        <div className="flex gap-2">
          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Criar Novo Cliente</DialogTitle>
              </DialogHeader>
              <CreateCustomerForm onCreated={handleCustomerCreated} />
            </DialogContent>
          </Dialog>

          <Button
            variant="secondary"
            onClick={() => setIsMassModalOpen(true)}
            disabled={selectedCustomerIds.length === 0}
          >
            Editar Acesso em Massa
          </Button>
        </div>
      </div>

      <MassAccessModal
        open={isMassModalOpen}
        onClose={() => setIsMassModalOpen(false)}
        customers={customers}
        products={massProducts}
        onApply={handleMassApply}
      />

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Selecionar</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id} className="hover:bg-gray-50">
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={isSelected(c.id)}
                      onChange={() => toggleSelectCustomer(c.id)}
                    />
                  </TableCell>
                  <TableCell className="flex flex-col">
                    <span className="font-medium">{c.name ?? "—"}</span>
                    <span className="text-xs text-gray-500">{c.email ?? ""}</span>
                  </TableCell>
                  <TableCell>{c.cpf ?? "—"}</TableCell>
                  <TableCell>{c.whatsapp ?? "—"}</TableCell>
                  <TableCell>
                    {Array.isArray(c.access) && c.access.length > 0 ? (
                      <Badge variant="secondary">{c.access.length} produto(s)</Badge>
                    ) : (
                      <span className="text-sm text-gray-500">Nenhum</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Customers;
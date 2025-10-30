"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import CreateCustomerForm from "@/components/admin/CreateCustomerForm";
import MassAccessModal from "@/components/admin/MassAccessModal";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";
import { Badge } from "@/components/ui/badge";

type CustomerSummary = {
  id: string;
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  whatsapp?: string | null;
  access: string[];
};

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMassModalOpen, setIsMassModalOpen] = useState(false);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access");

      if (error) {
        console.error("Error fetching customers:", error);
        setCustomers([]);
      } else {
        const formatted =
          data?.map((profile) => ({
            id: profile.id,
            name: profile.name,
            email: profile.email,
            cpf: profile.cpf,
            whatsapp: profile.whatsapp,
            access: Array.isArray(profile.access) ? profile.access : [],
          })) ?? [];
        setCustomers(formatted);
      }
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

  const handleMassApply = async (productIds: string[], customerIds: string[]) => {
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
  };

  const handleCustomerCreated = () => {
    setIsCreateModalOpen(false);
    fetchCustomers();
  };

  const hasCustomers = customers.length > 0;

  return (
    <div className="container mx-auto p-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Gerenciar Clientes</h1>
          <p className="text-sm text-gray-500">
            Cadastre novos clientes e distribua acesso aos produtos em massa.
          </p>
        </div>
        <div className="flex gap-2">
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : hasCustomers ? (
        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id} className="hover:bg-gray-50">
                  <TableCell className="flex flex-col gap-1 py-4">
                    <span className="font-semibold text-gray-900">
                      {customer.name ?? "—"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {customer.email ?? "Sem e-mail"}
                    </span>
                  </TableCell>
                  <TableCell>{customer.cpf ?? "—"}</TableCell>
                  <TableCell>{customer.whatsapp ?? "—"}</TableCell>
                  <TableCell>
                    {customer.access.length > 0 ? (
                      <Badge variant="secondary">
                        {customer.access.length} produto(s)
                      </Badge>
                    ) : (
                      <span className="text-sm text-gray-500">Nenhum acesso</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-gray-300 bg-white p-8 text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Nenhum cliente cadastrado ainda
          </h2>
          <p className="text-gray-500 mb-4">
            Comece cadastrando um novo cliente e distribua os acessos aos produtos
            conforme necessário.
          </p>
          <Button onClick={() => setIsCreateModalOpen(true)} className="bg-green-600 text-white">
            Criar primeiro cliente
          </Button>
        </div>
      )}

      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
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
    </div>
  );
};

export default Customers;
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import CreateCustomerForm from "@/components/admin/CreateCustomerForm";
import MassAccessModal from "@/components/admin/MassAccessModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";
import { Show } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [massModalOpen, setMassModalOpen] = useState(false);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);
  const [massSelectedCustomerIds, setMassSelectedCustomerIds] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("id, name, email, cpf, whatsapp, access");
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

  const fetchMassProducts = useCallback(async () => {
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
      fetchMassProducts();
    }
  }, [isSessionLoading, user, fetchCustomers, fetchMassProducts]);

  // Mass apply handler: add selected products to all selected customers
  const handleMassApply = async (productIds: string[], customerIds: string[]) => {
    if (productIds.length === 0 || customerIds.length === 0) return;
    // For each customer, merge access arrays
    const updates = customerIds.map(async (cid) => {
      try {
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("access")
          .eq("id", cid)
          .single();

        const existing = Array.isArray(profileData?.access) ? profileData.access : [];
        const merged = Array.from(new Set([...existing, ...productIds]));
        const { error: updateError } = await supabase
          .from("profiles")
          .update({ access: merged })
          .eq("id", cid);

        if (updateError) {
          throw updateError;
        }
      } catch (e) {
        throw e;
      }
    });

    await Promise.all(updates);
    await fetchCustomers();
  };

  // Selection handlers for mass edit
  const toggleMassCustomer = (id: string) => {
    setMassSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // Simple per-row selection (for mass edit) in UI
  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // UI helpers
  const isSelected = (id: string) => selectedCustomerIds.includes(id);

  // Create customer is preserved
  // Mass edit button opens MassAccessModal with current customers and products
  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
        <div className="flex gap-2">
          <DialogTrigger asChild>
            <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setIsModalOpen(true)}>
              Novo Cliente
            </Button>
          </DialogTrigger>
          <Button
            variant="secondary"
            onClick={() => {
              // Open mass access editor
              setMassModalOpen(true);
            }}
            disabled={selectedCustomerIds.length === 0}
          >
            Editar Acesso em Massa
          </Button>
        </div>
      </div>

      <MassAccessModal
        open={massModalOpen}
        onClose={() => setMassModalOpen(false)}
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
                <TableHead className="text-right">Ações</TableHead>
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
                  <TableCell className="flex items-center gap-2">
                    <span className="font-medium">{c.name ?? "—"}</span>
                    <span className="text-xs text-gray-500">{c.email ?? ""}</span>
                  </TableCell>
                  <TableCell>{c.cpf ?? "—"}</TableCell>
                  <TableCell>{c.whatsapp ?? "—"}</TableCell>
                  <TableCell>
                    {Array.isArray(c.access) && c.access.length > 0 ? (
                      <span className="text-sm">{c.access.length} produto(s)</span>
                    ) : (
                      <span className="text-sm text-gray-500">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-1"
                      title="Editar consumidor"
                    >
                      <Show className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <CreateCustomerForm onCreated={fetchCustomers} />
    </div>
  );
};

export default Customers;
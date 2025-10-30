"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import CreateCustomerForm from "@/components/admin/CreateCustomerForm";
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

import { Customer } from "@/types"; // if you add a type file later

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchCustomers = useCallback(async () => {
    // Fetch profiles for admin view
    setLoading(true);
    try {
      const { data, error } = await supabase.from("profiles").select("id, name, email, cpf, whatsapp, access");
      if (error) {
        console.error("Error fetching customers:", error);
      } else {
        setCustomers(data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Only admins should access this page; a real app would guard on server
    if (!isSessionLoading && user) {
      fetchCustomers();
    }
  }, [isSessionLoading, user, fetchCustomers]);

  // Refresh after creating a customer
  const handleCreated = () => {
    fetchCustomers();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
        <div className="flex gap-2">
          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-green-600 hover:bg-green-700 text-white">
                Novo Cliente
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md p-6">
              <DialogHeader>
                <DialogTitle>Novo Cliente</DialogTitle>
              </DialogHeader>
              <CreateCustomerForm onCreated={handleCreated} />
            </DialogContent>
          </Dialog>
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
                <TableHead>ID</TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Acessos</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.id}</TableCell>
                  <TableCell>{c.name ?? "—"}</TableCell>
                  <TableCell>{c.email ?? "—"}</TableCell>
                  <TableCell>{c.cpf ?? "—"}</TableCell>
                  <TableCell>{c.whatsapp ?? "—"}</TableCell>
                  <TableCell>{(c.access?.length ?? 0)}</TableCell>
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
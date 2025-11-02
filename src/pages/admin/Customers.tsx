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
import { useNavigate } from "react-router-dom";

// Definir tipos
type CustomerRow = {
  id: string;
  name?: string | null;
  email?: string | null;
  cpf?: string | null;
  whatsapp?: string | null;
  access?: string[];
  lastOrder?: {
    id: string;
    status: string;
    total_price: number;
    created_at: string;
  } | null;
};

type OrderSnapshot = NonNullable<CustomerRow['lastOrder']>;

const ADMIN_EMAIL = "higor.torres8@gmail.com";

const Customers = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const navigate = useNavigate();

  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMassModalOpen, setIsMassModalOpen] = useState(false);
  const [massProducts, setMassProducts] = useState<{ id: string; name: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // Editor individual
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);

  // Verificação de admin
  useEffect(() => {
    if (!isSessionLoading && (!user || user.email !== ADMIN_EMAIL)) {
      showError("Você não tem permissão para acessar esta página.");
      navigate('/meus-produtos');
    }
  }, [user, isSessionLoading, navigate]);

  const fetchCustomers = useCallback(async () => {
    if (!user || user.email !== ADMIN_EMAIL) return;

    setLoading(true);
    try {
      console.log('Fetching customers - Start');

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access")
        .order('created_at', { ascending: false });

      console.log('Fetched profiles:', profiles?.length || 0);

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

        console.log('Fetched orders:', ordersData?.length || 0);

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

      console.log('Final customers count:', customersWithOrders.length);
      setCustomers(customersWithOrders);
    } catch (error) {
      console.error('Unexpected error in fetchCustomers:', error);
      showError("Erro ao carregar clientes.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.email === ADMIN_EMAIL) {
      fetchCustomers();
    }
  }, [user, fetchCustomers]);

  // Renderização condicional para admin
  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || user.email !== ADMIN_EMAIL) {
    return null;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Gerenciar Clientes</h1>
        <Button 
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-green-600 hover:bg-green-700 text-white"
        >
          <Users className="mr-2 h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : customers.length === 0 ? (
        <div className="text-center text-gray-600 py-10">
          Nenhum cliente encontrado.
        </div>
      ) : (
        <div className="bg-white shadow rounded-lg overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Produtos</TableHead>
                <TableHead>Último Pedido</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>{customer.name || 'N/A'}</TableCell>
                  <TableCell>{customer.email || 'N/A'}</TableCell>
                  <TableCell>{customer.cpf ? formatCPF(customer.cpf) : 'N/A'}</TableCell>
                  <TableCell>{customer.whatsapp ? formatWhatsapp(customer.whatsapp) : 'N/A'}</TableCell>
                  <TableCell>{customer.access?.length || 0} produtos</TableCell>
                  <TableCell>
                    {customer.lastOrder ? (
                      <>
                        {new Date(customer.lastOrder.created_at).toLocaleDateString()}
                        <Badge variant={customer.lastOrder.status === 'paid' ? 'default' : 'destructive'} className="ml-2">
                          {customer.lastOrder.status}
                        </Badge>
                      </>
                    ) : (
                      'Sem pedidos'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => {
                        setEditingCustomer(customer);
                        setIsEditorOpen(true);
                      }}
                    >
                      <PencilLine className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modais de criação e edição de clientes */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Novo Cliente</DialogTitle>
          </DialogHeader>
          <CreateCustomerForm 
            onCreated={() => {
              setIsCreateModalOpen(false);
              fetchCustomers();
            }} 
          />
        </DialogContent>
      </Dialog>

      {editingCustomer && (
        <CustomerEditorModal
          open={isEditorOpen}
          onClose={() => {
            setIsEditorOpen(false);
            setEditingCustomer(null);
          }}
          customer={editingCustomer}
          products={[]} // Você pode adicionar lógica para buscar produtos
          onSave={() => {
            setIsEditorOpen(false);
            fetchCustomers();
          }}
          onPasswordReset={() => {
            setIsEditorOpen(false);
            fetchCustomers();
          }}
        />
      )}
    </div>
  );
};

export default Customers;
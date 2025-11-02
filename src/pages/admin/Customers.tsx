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

// Tipos e constantes anteriores permanecem iguais

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
      // Log de depuração para rastrear o número de clientes
      console.log('Fetching customers - Start');

      // Busca todos os perfis sem limite
      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, name, email, cpf, whatsapp, access")
        .order('created_at', { ascending: false }); // Ordenar por data de criação

      console.log('Fetched profiles:', profiles?.length || 0);

      if (profileError || !profiles) {
        console.error("Error fetching customers:", profileError);
        setCustomers([]);
        return;
      }

      const profileIds = profiles.map((profile) => profile.id);

      console.log('Profile IDs:', profileIds);

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
  }, []);

  // Resto do código permanece igual
  // ...
};

export default Customers;
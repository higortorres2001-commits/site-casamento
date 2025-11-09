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
import LogMetadataModal from "@/components/admin/LogMetadataModal";
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

type Log = {
  id: string;
  created_at: string;
  level: "info" | "error" | "warning";
  context: string;
  message: string;
  metadata: any;
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

const Logs = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
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
  const [editingLog, setEditingLog] = useState<Log | null>(null);

  // Debounce search term
  const debouncedSearch = useDebouncedCallback((value: string) => {
    setDebouncedSearchTerm(value);
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page on search
  }, 300);

  useEffect(() => {
    debouncedSearch(searchTerm);
  }, [searchTerm, debouncedSearch]);

  const fetchLogs = useCallback(async (page: number = 1, search: string = "") => {
    setLoading(true);
    try {
      // Calculate range for pagination
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("logs")
        .select("id, level, context, message, metadata, created_at")
        .order("created_at", { ascending: false });

      // Apply server-side search if provided
      if (search.trim()) {
        query = query.or(
          `message.ilike.%${search}%,context.ilike.%${search}%`
        );
      }

      // Apply pagination
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error("Error fetching logs:", error);
        showError("Erro ao carregar logs.");
        setLogs([]);
        setPagination({
          page: 1,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        });
        return;
      }

      console.log(`Fetched ${data?.length || 0} logs from database (page ${page})`);

      if (!data || data.length === 0) {
        setLogs([]);
        setPagination({
          page: 1,
          pageSize: PAGE_SIZE,
          total: 0,
          totalPages: 0,
        });
        return;
      }

      setLogs(data);
      
      // Update pagination
      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / PAGE_SIZE);
      
      setPagination({
        page,
        pageSize: PAGE_SIZE,
        total: totalCount,
        totalPages,
      });

      showSuccess(`${data.length} logs carregados com sucesso!`);
    } catch (error: any) {
      console.error("Unexpected error fetching logs:", error);
      showError("Erro inesperado ao carregar logs.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchLogs(1, "");
    }
  }, [isSessionLoading, user, fetchLogs]);

  // Load data when page or search changes
  useEffect(() => {
    if (!isSessionLoading && user) {
      fetchLogs(pagination.page, debouncedSearchTerm);
    }
  }, [pagination.page, debouncedSearchTerm, isSessionLoading, user, fetchLogs]);

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      setPagination(prev => ({ ...prev, page: newPage }));
    }
  };

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
  };

  const openLogModal = (log: Log) => {
    setEditingLog(log);
    setIsEditorOpen(true);
  };

  const closeModal = () => {
    setIsEditorOpen(false);
    setEditingLog(null);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge className="bg-red-100 text-red-800 border-red-200">ERRO</Badge>;
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">AVISO</Badge>;
      case "info":
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">INFO</Badge>;
    }
  };

  const getContextColor = (context: string) => {
    if (context.includes("login") || context.includes("auth")) return "text-purple-700 bg-purple-50";
    if (context.includes("payment") || context.includes("asaas")) return "text-green-700 bg-green-50";
    if (context.includes("user") || context.includes("customer")) return "text-blue-700 bg-blue-50";
    if (context.includes("checkout")) return "text-orange-700 bg-orange-50";
    return "text-gray-700 bg-gray-50";
  };

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
          <h1 className="text-3xl font-bold">Logs do Sistema</h1>
          <p className="text-gray-500">Gerencie e visualize todos os logs</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={() => fetchLogs(1, "")}
            className="flex items-center gap-2"
          >
            <Database className="h-4 w-4" />
            Recarregar Logs
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                <span>Logs ({pagination.total})</span>
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
                placeholder="Buscar logs..."
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
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-gray-500">
              {debouncedSearchTerm ? "Nenhum log encontrado com os critérios de busca." : "Nenhum log encontrado."}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-gray-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-24">Data/Hora</TableHead>
                      <TableHead>Nível</TableHead>
                      <TableHead>Contexto</TableHead>
                      <TableHead>Mensagem</TableHead>
                      <TableHead className="text-right">Metadados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} className="hover:bg-gray-50">
                        <TableCell className="text-xs">
                          {new Date(log.created_at).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getLevelIcon(log.level)}
                            {getLevelBadge(log.level)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            className={`text-xs ${getContextColor(log.context)}`}
                            variant="outline"
                          >
                            {log.context}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="truncate" title={log.message}>
                            {log.message}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openLogModal(log)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Ver metadados"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
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
                    Mostrando {logs.length} de {pagination.total} logs
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

      {/* Modal de metadados */}
      {editingLog && (
        <LogMetadataModal
          open={isEditorOpen}
          onClose={closeModal}
          log={editingLog}
        />
      )}
    </div>
  );
};

export default Logs;
"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Trash2, Search, Download, AlertTriangle, CheckCircle, Info, XCircle, Eye, FileText, Link2 } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/SessionContextProvider";
import LogMetadataModal from "@/components/admin/LogMetadataModal";
import { ADMIN_EMAILS } from "@/constants/admin";

export type Log = {
  id: string;
  created_at: string;
  level: "info" | "error" | "warning";
  context: string;
  message: string;
  metadata: any;
};

// Extrai informações de auditoria do metadata
const extractAuditInfo = (metadata: any) => {
  if (!metadata) return {};
  return {
    correlationId: metadata._correlation_id || null,
    userId: metadata._user_id || metadata.userId || null,
    orderId: metadata._order_id || metadata.orderId || metadata.order_id || null,
    paymentId: metadata._payment_id || metadata.paymentId || metadata.payment_id || null,
    customerEmail: metadata._customer_email || metadata.email || metadata.customerEmail || metadata.customer_email || null,
    productName: metadata.productName || metadata.product_name || (metadata.products && metadata.products[0]?.name) || null,
    productNames: metadata.productNames || (metadata.products?.map((p: any) => p.name)) || null,
    ipAddress: metadata._ip_address || metadata.ip || null,
    logHash: metadata._log_hash || null,
  };
};

const Logs = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [emailFilter, setEmailFilter] = useState<string>("");
  const [orderIdFilter, setOrderIdFilter] = useState<string>("");
  const [paymentIdFilter, setPaymentIdFilter] = useState<string>("");
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [auditTrailMode, setAuditTrailMode] = useState(false);
  const [correlationIdFilter, setCorrelationIdFilter] = useState<string>("");

  const isAdmin = user?.email && ADMIN_EMAILS.includes(user.email);

  const cleanupOldLogs = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90); // Aumentado para 90 dias para auditoria
    const { error } = await supabase
      .from("logs")
      .delete()
      .lt("created_at", cutoff.toISOString());
    if (error) {
      console.error("Error cleaning old logs:", error);
    }
  }, []);

  const fetchAvailableContexts = useCallback(async () => {
    const { data, error } = await supabase
      .from("logs")
      .select("context")
      .order("context");

    if (error) {
      console.error("Error fetching distinct contexts:", error);
    } else {
      const uniqueContexts = [...new Set(data?.map((item) => item.context))].sort();
      setAvailableContexts(uniqueContexts);
    }
  }, []);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    let query = supabase.from("logs").select("*").order("created_at", { ascending: false });

    // Aplicar filtros
    if (levelFilter !== "all") {
      query = query.eq("level", levelFilter);
    }
    if (contextFilter !== "all") {
      query = query.eq("context", contextFilter);
    }
    if (searchFilter.trim()) {
      query = query.or(`message.ilike.%${searchFilter}%,context.ilike.%${searchFilter}%`);
    }
    if (dateFilter !== "all") {
      const now = new Date();
      let cutoff = new Date();

      switch (dateFilter) {
        case "1h":
          cutoff.setHours(now.getHours() - 1);
          break;
        case "24h":
          cutoff.setDate(now.getDate() - 1);
          break;
        case "7d":
          cutoff.setDate(now.getDate() - 7);
          break;
        case "30d":
          cutoff.setDate(now.getDate() - 30);
          break;
      }

      if (dateFilter !== "all") {
        query = query.gte("created_at", cutoff.toISOString());
      }
    }

    const { data, error } = await query.limit(1000);

    if (error) {
      showError("Erro ao carregar logs: " + error.message);
      console.error("Error fetching logs:", error);
      setLogs([]);
    } else {
      let filteredLogs = data || [];

      // Filtros avançados no cliente (porque metadata é JSONB)
      if (emailFilter.trim()) {
        filteredLogs = filteredLogs.filter(log => {
          const auditInfo = extractAuditInfo(log.metadata);
          return auditInfo.customerEmail?.toLowerCase().includes(emailFilter.toLowerCase());
        });
      }

      if (orderIdFilter.trim()) {
        filteredLogs = filteredLogs.filter(log => {
          const auditInfo = extractAuditInfo(log.metadata);
          return auditInfo.orderId?.includes(orderIdFilter);
        });
      }

      if (paymentIdFilter.trim()) {
        filteredLogs = filteredLogs.filter(log => {
          const auditInfo = extractAuditInfo(log.metadata);
          return auditInfo.paymentId?.includes(paymentIdFilter);
        });
      }

      if (correlationIdFilter.trim()) {
        filteredLogs = filteredLogs.filter(log => {
          const auditInfo = extractAuditInfo(log.metadata);
          return auditInfo.correlationId?.includes(correlationIdFilter);
        });
      }

      // Sanitize metadata: remove internal_tag if present
      const sanitized = filteredLogs.map((log: Log) => {
        if (log.metadata && typeof log.metadata === "object") {
          const { internal_tag, ...rest } = log.metadata;
          return { ...log, metadata: rest };
        }
        return log;
      });
      setLogs(sanitized);
    }

    setIsLoading(false);
  }, [levelFilter, contextFilter, searchFilter, dateFilter, emailFilter, orderIdFilter, paymentIdFilter, correlationIdFilter]);

  // Buscar trilha de auditoria por correlation_id
  const fetchAuditTrail = useCallback(async (correlationId: string) => {
    setAuditTrailMode(true);
    setCorrelationIdFilter(correlationId);
    setLevelFilter("all");
    setContextFilter("all");
    setSearchFilter("");
    setDateFilter("all");
    setEmailFilter("");
    setOrderIdFilter("");
    setPaymentIdFilter("");
  }, []);

  useEffect(() => {
    if (isAdmin) {
      cleanupOldLogs();
    }
  }, [cleanupOldLogs, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAvailableContexts();
    }
  }, [isAdmin, fetchAvailableContexts]);

  useEffect(() => {
    if (isAdmin) {
      fetchLogs();
    }
  }, [isAdmin, fetchLogs]);

  const handleClearLogs = async () => {
    if (!isAdmin) {
      showError("Você não tem permissão para limpar os logs.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja apagar TODOS os logs? Esta ação é irreversível.")) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase
      .from("logs")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      showError("Erro ao limpar logs: " + error.message);
      console.error("Error clearing logs:", error);
    } else {
      showSuccess("Logs limpos com sucesso!");
      fetchLogs();
    }
    setIsLoading(false);
  };

  const exportLogs = () => {
    const csvContent = [
      ["Data/Hora", "Nível", "Contexto", "Mensagem", "Email Cliente", "Order ID", "Payment ID", "Correlation ID", "IP", "Metadados"].join(","),
      ...logs.map(log => {
        const auditInfo = extractAuditInfo(log.metadata);
        return [
          new Date(log.created_at).toLocaleString(),
          log.level,
          log.context,
          `"${log.message.replace(/"/g, '""')}"`,
          auditInfo.customerEmail || "",
          auditInfo.orderId || "",
          auditInfo.paymentId || "",
          auditInfo.correlationId || "",
          auditInfo.ipAddress || "",
          `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
        ].join(",");
      })
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess("Relatório exportado com sucesso!");
  };

  const exportAuditReport = () => {
    // Gerar relatório de auditoria em formato texto para impressão/PDF
    const reportDate = new Date().toLocaleString('pt-BR');
    const reportHash = btoa(JSON.stringify({ count: logs.length, date: reportDate })).substring(0, 16);

    let report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                    RELATÓRIO DE AUDITORIA - SEMESTRESS                       ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Data de Geração: ${reportDate.padEnd(59)}║
║ Total de Registros: ${String(logs.length).padEnd(57)}║
║ Hash de Verificação: ${reportHash.padEnd(56)}║
╚══════════════════════════════════════════════════════════════════════════════╝

Este relatório pode ser usado como prova documental em disputas e chargebacks.
A integridade pode ser verificada através do hash de cada log individual.

================================================================================
                              REGISTROS DE AUDITORIA
================================================================================

`;

    logs.forEach((log, index) => {
      const auditInfo = extractAuditInfo(log.metadata);
      report += `
[${index + 1}] ${new Date(log.created_at).toLocaleString('pt-BR')}
────────────────────────────────────────────────────────────────────────────────
Nível: ${log.level.toUpperCase()}
Contexto: ${log.context}
Mensagem: ${log.message}
${auditInfo.customerEmail ? `Email Cliente: ${auditInfo.customerEmail}` : ''}
${auditInfo.orderId ? `Order ID: ${auditInfo.orderId}` : ''}
${auditInfo.paymentId ? `Payment ID: ${auditInfo.paymentId}` : ''}
${auditInfo.correlationId ? `Correlation ID: ${auditInfo.correlationId}` : ''}
${auditInfo.ipAddress ? `IP: ${auditInfo.ipAddress}` : ''}
${auditInfo.logHash ? `Hash Integridade: ${auditInfo.logHash}` : ''}

Metadados:
${JSON.stringify(log.metadata, null, 2)}

`;
    });

    report += `
================================================================================
                              FIM DO RELATÓRIO
================================================================================
Gerado em: ${reportDate}
Sistema: SemEstress - Plataforma de Infoprodutos
Hash do Relatório: ${reportHash}
`;

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-report-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess("Relatório de auditoria exportado!");
  };

  const clearAuditTrailMode = () => {
    setAuditTrailMode(false);
    setCorrelationIdFilter("");
    fetchLogs();
  };

  const openLogModal = (log: Log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedLog(null);
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
    if (context.includes("webhook")) return "text-pink-700 bg-pink-50";
    return "text-gray-700 bg-gray-50";
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-slate-600">
            Você não tem permissão para visualizar os logs.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">Logs de Auditoria</h1>
          <Badge variant="outline">{logs.length} registros</Badge>
          {auditTrailMode && (
            <Badge className="bg-purple-100 text-purple-800 border-purple-200">
              <Link2 className="h-3 w-3 mr-1" />
              Trilha de Auditoria
            </Badge>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button variant="outline" onClick={exportAuditReport} className="flex items-center gap-2 bg-blue-50 hover:bg-blue-100 border-blue-200">
            <FileText className="h-4 w-4" /> Relatório de Auditoria
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} disabled={isLoading} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </div>

      {/* Alerta de Trilha de Auditoria */}
      {auditTrailMode && (
        <Card className="mb-4 border-purple-200 bg-purple-50">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-600" />
              <span className="text-purple-800 font-medium">
                Exibindo trilha de auditoria completa para correlação: {correlationIdFilter.substring(0, 8)}...
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={clearAuditTrailMode}>
              Limpar Filtro
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Filtros Avançados */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Auditoria
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Linha 1: Filtros principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar em mensagens..."
                  className="pl-9"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email do Cliente</label>
              <Input
                placeholder="cliente@email.com"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order ID</label>
              <Input
                placeholder="ID do pedido"
                value={orderIdFilter}
                onChange={(e) => setOrderIdFilter(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment ID</label>
              <Input
                placeholder="ID do pagamento Asaas"
                value={paymentIdFilter}
                onChange={(e) => setPaymentIdFilter(e.target.value)}
              />
            </div>
          </div>

          {/* Linha 2: Filtros secundários */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nível</label>
              <Select value={levelFilter} onValueChange={setLevelFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os níveis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os níveis</SelectItem>
                  <SelectItem value="error">Erros</SelectItem>
                  <SelectItem value="warning">Avisos</SelectItem>
                  <SelectItem value="info">Informações</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Contexto</label>
              <Select value={contextFilter} onValueChange={setContextFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os contextos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os contextos</SelectItem>
                  {availableContexts.map((ctx) => (
                    <SelectItem key={ctx} value={ctx}>
                      {ctx}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
              <Select value={dateFilter} onValueChange={setDateFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Todo o período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todo o período</SelectItem>
                  <SelectItem value="1h">Última hora</SelectItem>
                  <SelectItem value="24h">Últimas 24h</SelectItem>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end">
              <Button onClick={fetchLogs} disabled={isLoading} className="w-full flex items-center gap-2">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                Buscar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Logs */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gray-50 sticky top-0 z-10">
                  <TableRow>
                    <TableHead className="w-36">Data/Hora</TableHead>
                    <TableHead className="w-20">Nível</TableHead>
                    <TableHead className="w-40">Contexto</TableHead>
                    <TableHead className="w-48">Email Cliente</TableHead>
                    <TableHead className="min-w-[250px]">Mensagem</TableHead>
                    <TableHead className="w-24 text-center">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                        Nenhum log encontrado com os filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => {
                      const auditInfo = extractAuditInfo(log.metadata);
                      return (
                        <TableRow key={log.id} className="hover:bg-gray-50">
                          <TableCell className="text-xs">
                            <div className="flex flex-col">
                              <span>{new Date(log.created_at).toLocaleDateString('pt-BR')}</span>
                              <span className="text-gray-500">{new Date(log.created_at).toLocaleTimeString('pt-BR')}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
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
                            {auditInfo.customerEmail ? (
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-blue-600">{auditInfo.customerEmail}</span>
                                {auditInfo.orderId && (
                                  <span className="text-xs text-gray-500">Order: {auditInfo.orderId.substring(0, 8)}...</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm">
                            <div className="truncate max-w-[300px]" title={log.message}>
                              {log.message}
                            </div>
                            {auditInfo.productNames && auditInfo.productNames.length > 0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                Produtos: {auditInfo.productNames.join(", ")}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLogModal(log)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {auditInfo.correlationId && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => fetchAuditTrail(auditInfo.correlationId)}
                                  className="text-purple-600 hover:text-purple-800"
                                  title="Ver trilha de auditoria"
                                >
                                  <Link2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Metadados */}
      <LogMetadataModal
        open={isModalOpen}
        onClose={closeModal}
        log={selectedLog}
        onViewAuditTrail={fetchAuditTrail}
      />
    </div>
  );
};

export default Logs;
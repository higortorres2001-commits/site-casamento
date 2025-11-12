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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Loader2, 
  Trash2, 
  Search, 
  Download, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  XCircle, 
  Eye,
  Clock,
  User,
  Filter,
  RefreshCw,
  Timeline,
  Mail,
  ScrollText
} from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/SessionContextProvider";
import LogMetadataModal from "@/components/admin/LogMetadataModal";
import UserInvestigationPanel from "@/components/admin/UserInvestigationPanel";
import { useUserInvestigation } from "@/hooks/use-user-investigation";

export type Log = {
  id: string;
  created_at: string;
  level: "info" | "error" | "warning";
  context: string;
  message: string;
  metadata: any;
};

interface TimelineEvent {
  id: string;
  timestamp: string;
  level: string;
  context: string;
  message: string;
  metadata: any;
  relatedEmail?: string;
  relatedUserId?: string;
}

const Logs = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("24h");
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<Log | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Estados para linha do tempo
  const [timelineEmail, setTimelineEmail] = useState<string>("");
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineDateRange, setTimelineDateRange] = useState<string>("7d");

  // Hook de investigação
  const { investigateUser, isInvestigating, investigationResult, clearInvestigation } = useUserInvestigation();

  const isAdmin = user?.email === "higor.torres8@gmail.com";

  const cleanupOldLogs = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
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
      setLogs(data || []);
    }

    setIsLoading(false);
  }, [levelFilter, contextFilter, searchFilter, dateFilter]);

  const fetchTimelineForEmail = useCallback(async () => {
    if (!timelineEmail.trim()) {
      showError("Por favor, insira um email para buscar a linha do tempo.");
      return;
    }

    setIsLoadingTimeline(true);
    
    try {
      // Calcular range de data
      const now = new Date();
      let cutoff = new Date();
      
      switch (timelineDateRange) {
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

      // Buscar logs relacionados ao email
      const { data, error } = await supabase
        .from("logs")
        .select("*")
        .gte("created_at", cutoff.toISOString())
        .or(`metadata->>email.ilike.%${timelineEmail.toLowerCase()}%,message.ilike.%${timelineEmail.toLowerCase()}%`)
        .order("created_at", { ascending: true });

      if (error) {
        showError("Erro ao buscar linha do tempo: " + error.message);
        console.error("Error fetching timeline:", error);
        setTimelineEvents([]);
        return;
      }

      // Processar eventos para extrair informações relevantes
      const events: TimelineEvent[] = (data || []).map(log => {
        let relatedEmail = timelineEmail;
        let relatedUserId = null;

        // Extrair email e userId dos metadados
        if (log.metadata) {
          if (log.metadata.email) relatedEmail = log.metadata.email;
          if (log.metadata.userId) relatedUserId = log.metadata.userId;
          if (log.metadata.targetUserId) relatedUserId = log.metadata.targetUserId;
          if (log.metadata.userIdToUpdate) relatedUserId = log.metadata.userIdToUpdate;
        }

        return {
          id: log.id,
          timestamp: log.created_at,
          level: log.level,
          context: log.context,
          message: log.message,
          metadata: log.metadata,
          relatedEmail,
          relatedUserId
        };
      });

      setTimelineEvents(events);
      
      if (events.length === 0) {
        showError(`Nenhum evento encontrado para o email "${timelineEmail}" no período selecionado.`);
      } else {
        showSuccess(`${events.length} eventos encontrados para "${timelineEmail}".`);
      }
    } catch (error: any) {
      showError("Erro inesperado ao buscar linha do tempo: " + error.message);
      console.error("Unexpected timeline error:", error);
    } finally {
      setIsLoadingTimeline(false);
    }
  }, [timelineEmail, timelineDateRange]);

  useEffect(() => {
    if (isAdmin) {
      cleanupOldLogs();
      fetchAvailableContexts();
      fetchLogs();
    }
  }, [isAdmin, cleanupOldLogs, fetchAvailableContexts, fetchLogs]);

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
      ["Data/Hora", "Nível", "Contexto", "Mensagem", "Metadados"].join(","),
      ...logs.map(log => [
        new Date(log.created_at).toLocaleString(),
        log.level,
        log.context,
        `"${log.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(log.metadata).replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const exportTimeline = () => {
    if (timelineEvents.length === 0) {
      showError("Nenhum evento na linha do tempo para exportar.");
      return;
    }

    const csvContent = [
      ["Data/Hora", "Nível", "Contexto", "Mensagem", "Email", "User ID", "Metadados"].join(","),
      ...timelineEvents.map(event => [
        new Date(event.timestamp).toLocaleString(),
        event.level,
        event.context,
        `"${event.message.replace(/"/g, '""')}"`,
        event.relatedEmail || "",
        event.relatedUserId || "",
        `"${JSON.stringify(event.metadata).replace(/"/g, '""')}"`
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${timelineEmail}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess("Timeline exportada com sucesso!");
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
    if (context.includes("profile")) return "text-indigo-700 bg-indigo-50";
    if (context.includes("webhook")) return "text-pink-700 bg-pink-50";
    return "text-gray-700 bg-gray-50";
  };

  const getTimelineIcon = (context: string) => {
    if (context.includes("start") || context.includes("begin")) return "🚀";
    if (context.includes("success") || context.includes("complete")) return "✅";
    if (context.includes("error") || context.includes("fail")) return "❌";
    if (context.includes("warning") || context.includes("duplicate")) return "⚠️";
    if (context.includes("auth") || context.includes("login")) return "🔐";
    if (context.includes("payment") || context.includes("asaas")) return "💳";
    if (context.includes("profile") || context.includes("user")) return "👤";
    if (context.includes("webhook")) return "🔔";
    if (context.includes("email") || context.includes("verification")) return "📧";
    return "📝";
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
          <h1 className="text-3xl font-bold">Sistema de Logs & Investigação</h1>
          <Badge variant="outline">{logs.length} registros</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="outline" onClick={fetchLogs} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} disabled={isLoading} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Limpar Logs
          </Button>
        </div>
      </div>

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Logs Gerais
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Timeline className="h-4 w-4" />
            Linha do Tempo
          </TabsTrigger>
          <TabsTrigger value="investigation" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Investigação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="space-y-6">
          {/* Filtros Avançados */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros Avançados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nível</label>
                  <Select value={levelFilter} onValueChange={setLevelFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os níveis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os níveis</SelectItem>
                      <SelectItem value="error">🔴 Erros</SelectItem>
                      <SelectItem value="warning">🟡 Avisos</SelectItem>
                      <SelectItem value="info">🔵 Informações</SelectItem>
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
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Última hora</SelectItem>
                      <SelectItem value="24h">Últimas 24h</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                      <SelectItem value="all">Todo o período</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button onClick={fetchLogs} disabled={isLoading} className="w-full flex items-center gap-2">
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                    Aplicar
                  </Button>
                </div>
              </div>

              {/* Filtros Rápidos */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-sm font-medium text-gray-700">Filtros Rápidos:</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContextFilter("all");
                    setLevelFilter("error");
                    setDateFilter("24h");
                  }}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  🔴 Erros Recentes
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContextFilter("all");
                    setSearchFilter("checkout");
                    setDateFilter("7d");
                  }}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  🛒 Problemas de Checkout
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContextFilter("all");
                    setSearchFilter("auth");
                    setDateFilter("7d");
                  }}
                  className="text-purple-600 border-purple-200 hover:bg-purple-50"
                >
                  🔐 Problemas de Auth
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setContextFilter("all");
                    setSearchFilter("profile");
                    setDateFilter("7d");
                  }}
                  className="text-blue-600 border-blue-200 hover:bg-blue-50"
                >
                  👤 Problemas de Profile
                </Button>
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
                        <TableHead className="w-32">Data/Hora</TableHead>
                        <TableHead className="w-24">Nível</TableHead>
                        <TableHead className="w-40">Contexto</TableHead>
                        <TableHead className="min-w-[300px]">Mensagem</TableHead>
                        <TableHead className="w-32">Email/User</TableHead>
                        <TableHead className="w-20 text-center">Detalhes</TableHead>
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
                        logs.map((log) => (
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
                            <TableCell className="text-sm max-w-xs">
                              <div className="truncate" title={log.message}>
                                {log.message}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs">
                              {log.metadata?.email && (
                                <div className="flex items-center gap-1 mb-1">
                                  <Mail className="h-3 w-3 text-gray-500" />
                                  <span className="truncate max-w-[120px]" title={log.metadata.email}>
                                    {log.metadata.email}
                                  </span>
                                </div>
                              )}
                              {(log.metadata?.userId || log.metadata?.targetUserId) && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-gray-500" />
                                  <span className="font-mono text-xs">
                                    {(log.metadata.userId || log.metadata.targetUserId)?.substring(0, 8)}
                                  </span>
                                </div>
                              )}
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLogModal(log)}
                                className="text-blue-600 hover:text-blue-800"
                                title="Ver detalhes completos"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-6">
          {/* Busca por Email */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Timeline className="h-5 w-5" />
                Linha do Tempo por Email
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email do Cliente</label>
                  <Input
                    placeholder="cliente@exemplo.com"
                    value={timelineEmail}
                    onChange={(e) => setTimelineEmail(e.target.value)}
                    className="focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Período</label>
                  <Select value={timelineDateRange} onValueChange={setTimelineDateRange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Período" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Última hora</SelectItem>
                      <SelectItem value="24h">Últimas 24h</SelectItem>
                      <SelectItem value="7d">Últimos 7 dias</SelectItem>
                      <SelectItem value="30d">Últimos 30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end gap-2">
                  <Button 
                    onClick={fetchTimelineForEmail} 
                    disabled={isLoadingTimeline || !timelineEmail.trim()}
                    className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isLoadingTimeline ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Buscar Timeline
                  </Button>
                  {timelineEvents.length > 0 && (
                    <Button variant="outline" onClick={exportTimeline}>
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-800 mb-2">💡 Como usar a linha do tempo:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• Digite o email de um cliente que está com problemas</li>
                  <li>• Veja todos os eventos relacionados a esse email em ordem cronológica</li>
                  <li>• Identifique onde o processo falhou (auth, profile, pagamento, etc.)</li>
                  <li>• Use os detalhes para entender e corrigir o problema</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Timeline de Eventos */}
          {timelineEvents.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Linha do Tempo para: {timelineEmail}
                  </span>
                  <Badge variant="outline">{timelineEvents.length} eventos</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {timelineEvents.map((event, index) => (
                    <div key={event.id} className="relative">
                      {/* Linha conectora */}
                      {index < timelineEvents.length - 1 && (
                        <div className="absolute left-6 top-12 w-0.5 h-8 bg-gray-300"></div>
                      )}
                      
                      <div className="flex gap-4">
                        {/* Ícone da timeline */}
                        <div className="flex-shrink-0 w-12 h-12 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center text-lg">
                          {getTimelineIcon(event.context)}
                        </div>
                        
                        {/* Conteúdo do evento */}
                        <div className="flex-1 min-w-0">
                          <div className="bg-white border rounded-lg p-4 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {getLevelBadge(event.level)}
                                <Badge 
                                  className={`text-xs ${getContextColor(event.context)}`}
                                  variant="outline"
                                >
                                  {event.context}
                                </Badge>
                              </div>
                              <div className="text-xs text-gray-500">
                                {new Date(event.timestamp).toLocaleString()}
                              </div>
                            </div>
                            
                            <p className="text-sm text-gray-800 mb-2">{event.message}</p>
                            
                            {/* Informações extraídas dos metadados */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                              {event.relatedUserId && (
                                <div className="flex items-center gap-1">
                                  <User className="h-3 w-3 text-gray-500" />
                                  <span className="font-mono">{event.relatedUserId.substring(0, 8)}</span>
                                </div>
                              )}
                              {event.metadata?.orderId && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Pedido:</span>
                                  <span className="font-mono">{event.metadata.orderId.substring(0, 8)}</span>
                                </div>
                              )}
                              {event.metadata?.asaasPaymentId && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Pagamento:</span>
                                  <span className="font-mono">{event.metadata.asaasPaymentId}</span>
                                </div>
                              )}
                              {event.metadata?.paymentMethod && (
                                <div className="flex items-center gap-1">
                                  <span className="text-gray-500">Método:</span>
                                  <span>{event.metadata.paymentMethod}</span>
                                </div>
                              )}
                            </div>
                            
                            {/* Botão para ver metadados completos */}
                            <div className="mt-3 flex justify-end">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openLogModal(event)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                Ver Detalhes
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Resumo da Timeline */}
                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-semibold text-gray-800 mb-2">📊 Resumo da Timeline:</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Total de eventos:</span>
                      <span className="font-medium ml-2">{timelineEvents.length}</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Erros encontrados:</span>
                      <span className="font-medium ml-2 text-red-600">
                        {timelineEvents.filter(e => e.level === 'error').length}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Período analisado:</span>
                      <span className="font-medium ml-2">
                        {timelineDateRange === "1h" ? "1 hora" : 
                         timelineDateRange === "24h" ? "24 horas" :
                         timelineDateRange === "7d" ? "7 dias" : "30 dias"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="investigation" className="space-y-6">
          {/* Investigação de Usuário */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5" />
                Investigação Completa de Usuário
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email do Cliente</label>
                  <Input
                    placeholder="cliente@exemplo.com"
                    value={timelineEmail}
                    onChange={(e) => setTimelineEmail(e.target.value)}
                    className="focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>
                <div className="flex items-end">
                  <Button 
                    onClick={() => investigateUser(timelineEmail)} 
                    disabled={isInvestigating || !timelineEmail.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {isInvestigating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4 mr-2" />
                    )}
                    Investigar Usuário
                  </Button>
                </div>
              </div>
              
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-semibold text-orange-800 mb-2">🔍 Investigação Completa:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• Verifica se o usuário existe no auth e na tabela de perfis</li>
                  <li>• Analisa inconsistências entre os dados</li>
                  <li>• Mostra histórico de pedidos e status de pagamento</li>
                  <li>• Identifica problemas específicos e sugere soluções</li>
                  <li>• Exibe logs recentes relacionados ao usuário</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Resultado da Investigação */}
          {investigationResult && (
            <UserInvestigationPanel 
              result={investigationResult} 
              email={timelineEmail}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Modal de Metadados */}
      <LogMetadataModal
        open={isModalOpen}
        onClose={closeModal}
        log={selectedLog}
      />
    </div>
  );
};

export default Logs;
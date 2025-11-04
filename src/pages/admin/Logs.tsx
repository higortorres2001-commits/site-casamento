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
import { Loader2, Trash2, Search, Download, Eye, AlertTriangle, CheckCircle, Info, XCircle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { useSession } from "@/components/SessionContextProvider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type Log = {
  id: string;
  created_at: string;
  level: "info" | "error" | "warning";
  context: string;
  message: string;
  metadata: any;
};

const Logs = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [viewingLog, setViewingLog] = useState<Log | null>(null);

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
    const { data, error } = await supabase.from("logs").select("context", { distinct: true });
    if (error) {
      console.error("Error fetching distinct contexts:", error);
    } else {
      const contexts = data?.map((item) => item.context).sort() || [];
      setAvailableContexts(contexts);
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
      // Sanitize metadata: remove internal_tag if present
      const sanitized = (data || []).map((log: Log) => {
        if (log.metadata && typeof log.metadata === "object") {
          const { internal_tag, ...rest } = log.metadata;
          return { ...log, metadata: rest };
        }
        return log;
      });
      setLogs(sanitized);
    }

    setIsLoading(false);
  }, [levelFilter, contextFilter, searchFilter, dateFilter]);

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

  const renderMetadata = (metadata: any) => {
    if (!metadata) return "N/A";
    try {
      const serialized = typeof metadata === "string" ? metadata : JSON.stringify(metadata);
      const clean = serialized?.replace(/"internal_tag\\":\\s*"[^"]*",?/, "");
      return clean.length > 200 ? `${clean.slice(0, 200)}…` : clean;
    } catch {
      return "Metadados não legíveis";
    }
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
          <h1 className="text-3xl font-bold">Logs do Sistema</h1>
          <Badge variant="outline">{logs.length} registros</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportLogs} className="flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
          <Button variant="destructive" onClick={handleClearLogs} disabled={isLoading} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Limpar Logs
          </Button>
        </div>
      </div>

      {/* Filtros Avançados */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar em mensagens ou contexto..."
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
          </div>

          <div className="flex justify-end">
            <Button onClick={fetchLogs} disabled={isLoading} className="flex items-center gap-2">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              Aplicar Filtros
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
                <TableHeader className="bg-gray-50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-24">Data/Hora</TableHead>
                    <TableHead className="w-20">Nível</TableHead>
                    <TableHead className="w-32">Contexto</TableHead>
                    <TableHead>Mensagem</TableHead>
                    <TableHead className="w-48">Metadados</TableHead>
                    <TableHead className="w-20">Ações</TableHead>
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
                        <TableCell className="text-sm max-w-xs break-words">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <span className="cursor-pointer hover:text-blue-600">
                                {log.message.length > 100 ? `${log.message.slice(0, 100)}...` : log.message}
                              </span>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <p className="text-xs text-gray-600 mt-1">{log.message}</p>
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                        <TableCell className="text-xs max-w-[250px]">
                          <Collapsible>
                            <CollapsibleTrigger asChild>
                              <div className="cursor-pointer hover:text-blue-600 font-mono bg-gray-50 p-1 rounded">
                                {renderMetadata(log.metadata)}
                              </div>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              <Textarea 
                                value={JSON.stringify(log.metadata, null, 2)} 
                                readOnly 
                                className="text-xs mt-2 font-mono"
                                rows={5}
                              />
                            </CollapsibleContent>
                          </Collapsible>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingLog(log)}
                            className="text-blue-600 hover:text-blue-800"
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

      {/* Modal de Visualização Detalhada */}
      <Dialog open={!!viewingLog} onOpenChange={() => setViewingLog(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingLog && getLevelIcon(viewingLog.level)}
              Detalhes do Log
            </DialogTitle>
            <DialogDescription>
              Visualização completa do registro de log
            </DialogDescription>
          </DialogHeader>
          
          {viewingLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Data/Hora</label>
                  <p className="text-sm">{new Date(viewingLog.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Nível</label>
                  <div className="flex items-center gap-2">
                    {getLevelIcon(viewingLog.level)}
                    {getLevelBadge(viewingLog.level)}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contexto</label>
                  <Badge className={getContextColor(viewingLog.context)} variant="outline">
                    {viewingLog.context}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">ID</label>
                  <p className="text-xs font-mono">{viewingLog.id}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Mensagem</label>
                <p className="text-sm bg-gray-50 p-3 rounded">{viewingLog.message}</p>
              </div>
              
              <div>
                <label className="text-sm font-medium text-gray-700">Metadados (JSON)</label>
                <Textarea 
                  value={JSON.stringify(viewingLog.metadata, null, 2)} 
                  readOnly 
                  className="text-xs font-mono bg-gray-50"
                  rows={10}
                />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Logs;
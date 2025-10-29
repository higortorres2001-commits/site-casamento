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
import { Loader2, Trash2 } from "lucide-react"; // Import Trash2 icon for clear logs
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { useSession } from "@/components/SessionContextProvider"; // Import useSession

interface Log {
  id: string;
  created_at: string;
  level: "info" | "error" | "warning";
  context: string;
  message: string;
  metadata: any;
}

const ADMIN_EMAIL = "higor.torres8@gmail.com"; // Definir o email do administrador

const Logs = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [logs, setLogs] = useState<Log[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [contextFilter, setContextFilter] = useState<string>("all");
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);

  const isAdmin = user?.email === ADMIN_EMAIL;

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    let query = supabase.from("logs").select("*").order("created_at", { ascending: false });

    if (levelFilter !== "all") {
      query = query.eq("level", levelFilter);
    }
    if (contextFilter !== "all") {
      query = query.eq("context", contextFilter);
    }

    const { data, error } = await query;

    if (error) {
      showError("Erro ao carregar logs: " + error.message);
      console.error("Error fetching logs:", error);
      setLogs([]);
    } else {
      setLogs(data || []);
    }
    setIsLoading(false);
  }, [levelFilter, contextFilter]);

  const fetchAvailableContexts = useCallback(async () => {
    // This query might need RLS adjustments if not all users can see all contexts
    const { data, error } = await supabase
      .from("logs")
      .select("context", { distinct: true }); // Corrigido: usar { distinct: true } no select

    if (error) {
      console.error("Error fetching distinct contexts:", error);
    } else {
      const contexts = data?.map((item) => item.context).sort() || [];
      setAvailableContexts(contexts);
    }
  }, []);

  useEffect(() => {
    fetchAvailableContexts();
  }, [fetchAvailableContexts]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    if (!isAdmin) {
      showError("Você não tem permissão para limpar os logs.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja apagar TODOS os logs? Esta ação é irreversível.")) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all records
    if (error) {
      showError("Erro ao limpar logs: " + error.message);
      console.error("Error clearing logs:", error);
    } else {
      showSuccess("Logs limpos com sucesso!");
      fetchLogs(); // Re-fetch to show empty state
    }
    setIsLoading(false);
  };

  if (isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Logs do Sistema</h1>
        {isAdmin && (
          <Button
            variant="destructive"
            onClick={handleClearLogs}
            disabled={isLoading}
            className="flex items-center gap-2"
          >
            <Trash2 className="h-4 w-4" /> Limpar Logs
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[180px]">
          <label htmlFor="level-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Nível
          </label>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger id="level-filter" className="w-full">
              <SelectValue placeholder="Todos os Níveis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Níveis</SelectItem>
              <SelectItem value="info">Info</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="error">Error</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 min-w-[180px]">
          <label htmlFor="context-filter" className="block text-sm font-medium text-gray-700 mb-1">
            Filtrar por Contexto
          </label>
          <Select value={contextFilter} onValueChange={setContextFilter}>
            <SelectTrigger id="context-filter" className="w-full">
              <SelectValue placeholder="Todos os Contextos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Contextos</SelectItem>
              {availableContexts.map((context) => (
                <SelectItem key={context} value={context}>
                  {context}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={() => { setLevelFilter("all"); setContextFilter("all"); }} variant="outline" className="self-end">
          Limpar Filtros
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center min-h-[200px]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[180px]">Data/Hora</TableHead>
                <TableHead className="w-[80px]">Nível</TableHead>
                <TableHead className="w-[150px]">Contexto</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead className="w-[250px]">Metadados</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-gray-500">
                    Nenhum log encontrado com os filtros aplicados.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          log.level === "error"
                            ? "bg-red-100 text-red-800"
                            : log.level === "warning"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.level}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{log.context}</TableCell>
                    <TableCell className="text-sm max-w-xs break-words">{log.message}</TableCell>
                    <TableCell className="text-xs max-w-[250px] break-words font-mono bg-gray-50 p-2 rounded-md">
                      {log.metadata ? JSON.stringify(log.metadata, null, 2) : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default Logs;
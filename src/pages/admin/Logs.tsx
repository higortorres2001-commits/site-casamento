"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Loader2, Trash2, FileText } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSession } from "@/components/SessionContextProvider";
import { Card } from "@/components/ui/card";

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
  const [availableContexts, setAvailableContexts] = useState<string[]>([]);
  const [viewingPdf, setViewingPdf] = useState<{ url: string; fileName?: string } | null>(null);

  const isAdmin = user?.email === "higor.torres8@gmail.com";

  // Cleanup old logs (older than 30 days)
  const cleanupOldLogs = useCallback(async () => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    try {
      const { data, error } = await supabase
        .from("logs")
        .delete()
        .lt("created_at", cutoff.toISOString());
      if (error) {
        console.error("Error cleaning old logs:", error);
      } else {
        // Optionally refresh after cleanup
        // fetchLogs();
      }
    } catch (e) {
      console.error("Unexpected error during log cleanup:", e);
    }
  }, []);

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

    // Always stop by showing the latest 200-ish entries (prevent log bloat on UI)
    setIsLoading(false);
  }, [levelFilter, contextFilter]);

  useEffect(() => {
    if (isAdmin) {
      cleanupOldLogs();
    }
  }, [cleanupOldLogs, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      fetchAvailableContexts();
      fetchLogs();
    }
  }, [fetchAvailableContexts, fetchLogs, isAdmin]);

  const fetchAvailableContexts = useCallback(async () => {
    const { data, error } = await supabase.from("logs").select("context", { distinct: true });
    if (error) {
      console.error("Error fetching distinct contexts:", error);
    } else {
      const contexts = data?.map((item) => item.context).sort() || [];
      setAvailableContexts(contexts);
    }
  }, []);

  const handleClearLogs = async () => {
    if (!isAdmin) {
      showError("Você não tem permissão para limpar os logs.");
      return;
    }
    if (!window.confirm("Tem certeza que deseja apagar TODOS os logs? Esta ação é irreversível.")) {
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.from("logs").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) {
      showError("Erro ao limpar logs: " + error.message);
      console.error("Error clearing logs:", error);
    } else {
      showSuccess("Logs limpos com sucesso!");
      fetchLogs();
    }
    setIsLoading(false);
  };

  // PDF viewer UI helpers
  const openPdf = (signedUrl: string, fileName?: string) => {
    setViewingPdf({ url: signedUrl, fileName });
  };

  const closePdf = () => setViewingPdf(null);

  // Helper to render a compact metadata string
  const renderMetadata = (md: any) => {
    if (!md) return "N/A";
    try {
      const str = typeof md === "string" ? md : JSON.stringify(md);
      return str.length > 200 ? str.slice(0, 200) + "…" : str;
    } catch {
      return "Metadados não legíveis";
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Logs do Sistema</h1>
        {isAdmin && (
          <Button variant="destructive" onClick={handleClearLogs} disabled={isLoading} className="flex items-center gap-2">
            <Trash2 className="h-4 w-4" /> Limpar Logs
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[180px]">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Nível</label>
          <Select value={levelFilter} onValueChange={setLevelFilter}>
            <SelectTrigger className="w-full" id="level-filter">
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
          <label className="block text-sm font-medium text-gray-700 mb-1">Filtrar por Contexto</label>
          <Select value={contextFilter} onValueChange={setContextFilter}>
            <SelectTrigger className="w-full" id="context-filter">
              <SelectValue placeholder="Todos os Contextos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os Contextos</SelectItem>
              {availableContexts.map((ctx) => (
                <SelectItem key={ctx} value={ctx}>{ctx}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
                <TableHead>Data/Hora</TableHead>
                <TableHead>Nível</TableHead>
                <TableHead>Contexto</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Metadados</TableHead>
                <TableHead>Ações</TableHead>
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
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">{new Date(log.created_at).toLocaleString()}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          log.level === "error" ? "bg-red-100 text-red-800" :
                          log.level === "warning" ? "bg-yellow-100 text-yellow-800" :
                          "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {log.level}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{log.context}</TableCell>
                    <TableCell className="text-sm max-w-xs break-words">{log.message}</TableCell>
                    <TableCell className="text-xs max-w-[250px] break-words font-mono bg-gray-50 p-2 rounded-md" title={JSON.stringify(log.metadata)}>
                      {renderMetadata(log.metadata)}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.metadata?.signedUrl ? (
                        <Button variant="ghost" size="sm" onClick={() => openPdf(log.metadata.signedUrl, log.metadata.fileName)}>
                          Visualizar PDF
                        </Button>
                      ) : (
                        <span className="text-sm text-gray-500">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!viewingPdf} onOpenChange={(open) => { if (!open) closePdf(); }}>
        <DialogContent className="sm:max-w-4xl w-full h-[70vh]">
          <DialogHeader>
            <DialogTitle>Visualização de PDF</DialogTitle>
            <DialogDescription>Arquivo solicitado pelos logs.</DialogDescription>
          </DialogHeader>
          {viewingPdf?.url ? (
            <iframe src={viewingPdf.url} title={viewingPdf.fileName ?? "PDF"} className="w-full h-full border-0" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">Nenhum PDF carregado.</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Logs;
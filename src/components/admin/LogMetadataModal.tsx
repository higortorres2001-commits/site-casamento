import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, CheckCircle, AlertTriangle, XCircle, Info } from "lucide-react";
import { Log } from "@/types/log";

interface LogMetadataModalProps {
  open: boolean;
  onClose: () => void;
  log: Log | null;
}

const LogMetadataModal = ({ open, onClose, log }: LogMetadataModalProps) => {
  if (!log) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "info":
      default:
        return <Info className="h-5 w-5 text-blue-500" />;
    }
  };

  const getLevelBadge = (level: string) => {
    const colors = {
      error: "bg-red-100 text-red-800 border-red-200",
      warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
      info: "bg-blue-100 text-blue-800 border-blue-200"
    };
    
    return (
      <Badge className={colors[level as keyof typeof colors] || "bg-gray-100 text-gray-800"}>
        {level}
      </Badge>
    );
  };

  const getContextColor = (context: string) => {
    if (context.includes("login") || context.includes("auth")) return "text-purple-700 bg-purple-50";
    if (context.includes("payment") || context.includes("asaas")) return "text-green-700 bg-green-50";
    if (context.includes("user") || context.includes("customer")) return "text-blue-700 bg-blue-50";
    if (context.includes("checkout")) return "text-orange-700 bg-orange-50";
    return "text-gray-700 bg-gray-50";
  };

  const renderMetadataValue = (value: any, key: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">N/A</span>;
    }

    if (typeof value === "object") {
      return (
        <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
          <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap break-all">
            {JSON.stringify(value, null, 2)}
          </pre>
        </div>
      );
    }

    if (typeof value === "string") {
      // Detectar se parece ser JSON
      if (value.startsWith("{") || value.startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          return renderMetadataValue(parsed, key);
        } catch {
          // Se não for JSON válido, exibir como string
          return (
            <div className="bg-gray-100 rounded p-2">
              <code className="text-sm text-gray-800 break-all whitespace-pre-wrap">
                {value}
              </code>
            </div>
          );
        }
      }
    }

    // Para valores primitivos (string, number, boolean)
    return (
      <div className="bg-gray-50 rounded p-2">
        <span className="text-sm text-gray-800 break-all whitespace-pre-wrap">
          {String(value)}
        </span>
      </div>
    );
  };

  const metadata = log.metadata || {};
  const metadataEntries = Object.entries(metadata).filter(([key]) => key !== "internal_tag");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            {getLevelIcon(log.level)}
            <div>
              <DialogTitle className="text-xl">Detalhes do Log</DialogTitle>
              <div className="flex items-center gap-2 mt-1">
                {getLevelBadge(log.level)}
                <Badge 
                  className={`text-xs ${getContextColor(log.context)}`}
                  variant="outline"
                >
                  {log.context}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  ID: {log.id.substring(0, 8)}
                </Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Informações básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Informações Gerais</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Data/Hora:</span>
                  <span className="font-medium">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Nível:</span>
                  <div className="flex items-center gap-2">
                    {getLevelBadge(log.level)}
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Contexto:</span>
                  <Badge 
                    className={`text-xs ${getContextColor(log.context)}`}
                    variant="outline"
                  >
                    {log.context}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-gray-700">Mensagem</h4>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800 break-all whitespace-pre-wrap">
                  {log.message}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(log.message)}
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
            </div>
          </div>

          {/* Metadados */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Metadados</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(metadata, null, 2))}
                className="text-gray-600 hover:text-gray-800"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar JSON
              </Button>
            </div>

            {metadataEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum metadado disponível para este log</p>
              </div>
            ) : (
              <div className="space-y-4">
                {metadataEntries.map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="text-sm font-medium text-gray-700 capitalize">
                        {key.replace(/_/g, " ")}
                      </h5>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(String(value))}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    {renderMetadataValue(value, key)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Ações rápidas para erros */}
        {log.level === "error" && (
          <div className="border-t pt-4">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Ações Recomendadas</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <h5 className="text-sm font-medium text-red-800 mb-1">🔍 Investigar Erro</h5>
                <p className="text-xs text-red-700">
                  Verifique os logs relacionados para identificar a causa raiz deste erro.
                </p>
              </div>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                <h5 className="text-sm font-medium text-orange-800 mb-1">📊 Monitorar Frequência</h5>
                <p className="text-xs text-orange-700">
                  Filtre por este contexto para ver se o erro está ocorrendo repetidamente.
                </p>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LogMetadataModal;
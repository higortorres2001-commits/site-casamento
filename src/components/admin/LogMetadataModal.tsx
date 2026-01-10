import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, CheckCircle, AlertTriangle, XCircle, Info, Shield, Link2, Globe, Monitor, FileText } from "lucide-react";
import { Log } from "@/pages/admin/Logs";
import { showSuccess } from "@/utils/toast";

interface LogMetadataModalProps {
  open: boolean;
  onClose: () => void;
  log: Log | null;
  onViewAuditTrail?: (correlationId: string) => void;
}

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
    ipAddress: metadata._ip_address || metadata.ip || metadata._forensic?.ip || null,
    userAgent: metadata._user_agent || metadata.ua || metadata._forensic?.ua || null,
    origin: metadata._forensic?.origin || null,
    logHash: metadata._log_hash || null,
    auditTimestamp: metadata._audit_timestamp || null,
    eventType: metadata.event_type || null,
  };
};

const LogMetadataModal = ({ open, onClose, log, onViewAuditTrail }: LogMetadataModalProps) => {
  if (!log) return null;

  const auditInfo = extractAuditInfo(log.metadata);

  const copyToClipboard = (text: string, label?: string) => {
    navigator.clipboard.writeText(text);
    showSuccess(`${label || 'Texto'} copiado!`);
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

  const renderMetadataValue = (value: any, key: string): React.ReactNode => {
    // Ocultar campos internos de auditoria na visualização de metadados
    if (key.startsWith('_')) return null;

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
      if (value.startsWith("{") || value.startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          return renderMetadataValue(parsed, key);
        } catch {
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

    return (
      <div className="bg-gray-50 rounded p-2">
        <span className="text-sm text-gray-800 break-all whitespace-pre-wrap">
          {String(value)}
        </span>
      </div>
    );
  };

  const metadata = log.metadata || {};
  const metadataEntries = Object.entries(metadata).filter(([key]) =>
    !key.startsWith('_') && key !== 'internal_tag'
  );

  const generateSingleLogReport = () => {
    const reportDate = new Date().toLocaleString('pt-BR');
    const report = `
╔══════════════════════════════════════════════════════════════════════════════╗
║                 RELATÓRIO INDIVIDUAL DE AUDITORIA - SEMESTRESS               ║
╠══════════════════════════════════════════════════════════════════════════════╣
║ Data de Geração: ${reportDate.padEnd(59)}║
║ Log ID: ${log.id.padEnd(69)}║
╚══════════════════════════════════════════════════════════════════════════════╝

INFORMAÇÕES DO EVENTO
================================================================================
Data/Hora do Evento: ${new Date(log.created_at).toLocaleString('pt-BR')}
Nível: ${log.level.toUpperCase()}
Contexto: ${log.context}
Mensagem: ${log.message}

DADOS DO CLIENTE
================================================================================
Email: ${auditInfo.customerEmail || 'N/A'}
User ID: ${auditInfo.userId || 'N/A'}

DADOS DA TRANSAÇÃO
================================================================================
Order ID: ${auditInfo.orderId || 'N/A'}
Payment ID: ${auditInfo.paymentId || 'N/A'}
Correlation ID: ${auditInfo.correlationId || 'N/A'}

DADOS FORENSES
================================================================================
IP Address: ${auditInfo.ipAddress || 'N/A'}
User Agent: ${auditInfo.userAgent || 'N/A'}
Origin: ${auditInfo.origin || 'N/A'}
Hash de Integridade: ${auditInfo.logHash || 'N/A'}

METADADOS COMPLETOS
================================================================================
${JSON.stringify(log.metadata, null, 2)}

================================================================================
Este documento pode ser utilizado como prova em disputas e chargebacks.
A integridade deste log é garantida pelo hash SHA-256 acima.
Gerado em: ${reportDate}
================================================================================
`;

    const blob = new Blob([report], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${log.id.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    window.URL.revokeObjectURL(url);
    showSuccess("Relatório do log exportado!");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            {getLevelIcon(log.level)}
            <div>
              <DialogTitle className="text-xl">Detalhes do Log</DialogTitle>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
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
                {auditInfo.logHash && (
                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                    <Shield className="h-3 w-3 mr-1" />
                    Verificado
                  </Badge>
                )}
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
                    {new Date(log.created_at).toLocaleString('pt-BR')}
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
                {auditInfo.eventType && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tipo de Evento:</span>
                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">
                      {auditInfo.eventType}
                    </Badge>
                  </div>
                )}
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
                  onClick={() => copyToClipboard(log.message, 'Mensagem')}
                  className="mt-2 text-blue-600 hover:text-blue-800"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar
                </Button>
              </div>
            </div>
          </div>

          {/* Dados do Cliente e Transação */}
          {(auditInfo.customerEmail || auditInfo.orderId || auditInfo.paymentId) && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Info className="h-4 w-4" />
                Dados da Transação
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                {auditInfo.customerEmail && (
                  <div>
                    <span className="text-gray-600 block text-xs">Email do Cliente</span>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-blue-600">{auditInfo.customerEmail}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(auditInfo.customerEmail, 'Email')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {auditInfo.orderId && (
                  <div>
                    <span className="text-gray-600 block text-xs">Order ID</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{auditInfo.orderId}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(auditInfo.orderId, 'Order ID')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
                {auditInfo.paymentId && (
                  <div>
                    <span className="text-gray-600 block text-xs">Payment ID (Asaas)</span>
                    <div className="flex items-center gap-2">
                      <code className="font-mono text-xs bg-gray-200 px-2 py-1 rounded">{auditInfo.paymentId}</code>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => copyToClipboard(auditInfo.paymentId, 'Payment ID')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Dados Forenses */}
          {(auditInfo.ipAddress || auditInfo.userAgent || auditInfo.correlationId) && (
            <div className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
              <h4 className="text-sm font-semibold text-yellow-800 mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Dados Forenses (Auditoria)
              </h4>
              <div className="grid grid-cols-1 gap-3 text-sm">
                {auditInfo.correlationId && (
                  <div className="flex items-center justify-between bg-yellow-100 rounded p-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="h-4 w-4 text-yellow-700" />
                      <span className="text-yellow-800 font-medium">Correlation ID:</span>
                      <code className="font-mono text-xs">{auditInfo.correlationId}</code>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7"
                        onClick={() => copyToClipboard(auditInfo.correlationId, 'Correlation ID')}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {onViewAuditTrail && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                          onClick={() => {
                            onViewAuditTrail(auditInfo.correlationId);
                            onClose();
                          }}
                        >
                          <Link2 className="h-3 w-3 mr-1" />
                          Ver Trilha Completa
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {auditInfo.ipAddress && (
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-yellow-700" />
                    <span className="text-yellow-800">IP:</span>
                    <code className="font-mono text-xs bg-yellow-100 px-2 py-1 rounded">{auditInfo.ipAddress}</code>
                  </div>
                )}

                {auditInfo.userAgent && (
                  <div className="flex items-start gap-2">
                    <Monitor className="h-4 w-4 text-yellow-700 mt-1" />
                    <div>
                      <span className="text-yellow-800">User Agent:</span>
                      <div className="bg-yellow-100 rounded p-2 mt-1">
                        <code className="font-mono text-xs break-all">{auditInfo.userAgent}</code>
                      </div>
                    </div>
                  </div>
                )}

                {auditInfo.logHash && (
                  <div className="flex items-center gap-2 pt-2 border-t border-yellow-200">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span className="text-green-700 font-medium">Hash de Integridade:</span>
                    <code className="font-mono text-xs text-green-800">{auditInfo.logHash.substring(0, 32)}...</code>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs ml-2">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Íntegro
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Metadados */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Metadados</h4>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(metadata, null, 2), 'JSON')}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copiar JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateSingleLogReport}
                  className="text-blue-600 hover:text-blue-800 bg-blue-50"
                >
                  <FileText className="h-3 w-3 mr-1" />
                  Exportar Relatório
                </Button>
              </div>
            </div>

            {metadataEntries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Info className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <p>Nenhum metadado adicional disponível</p>
              </div>
            ) : (
              <div className="space-y-4">
                {metadataEntries.map(([key, value]) => {
                  const rendered = renderMetadataValue(value, key);
                  if (rendered === null) return null;
                  return (
                    <div key={key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h5 className="text-sm font-medium text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </h5>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(typeof value === 'object' ? JSON.stringify(value) : String(value), key)}
                          className="text-gray-500 hover:text-gray-700"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {rendered}
                    </div>
                  );
                })}
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
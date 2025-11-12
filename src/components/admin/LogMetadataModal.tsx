"use client";

import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Copy, CheckCircle, AlertTriangle, XCircle, Info, User, Mail, CreditCard, Package } from "lucide-react";
import { Log } from "@/pages/admin/Logs";
import { showSuccess } from "@/utils/toast";

interface LogMetadataModalProps {
  open: boolean;
  onClose: () => void;
  log: Log | null;
}

const LogMetadataModal = ({ open, onClose, log }: LogMetadataModalProps) => {
  if (!log) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess("Copiado para a área de transferência!");
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
    if (context.includes("profile")) return "text-indigo-700 bg-indigo-50";
    if (context.includes("webhook")) return "text-pink-700 bg-pink-50";
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
  
  // Extrair informações importantes dos metadados
  const extractedInfo = {
    email: metadata.email || metadata.targetEmail || null,
    userId: metadata.userId || metadata.targetUserId || metadata.userIdToUpdate || null,
    orderId: metadata.orderId || null,
    asaasPaymentId: metadata.asaasPaymentId || null,
    paymentMethod: metadata.paymentMethod || null,
    error: metadata.error || metadata.errorMessage || null,
    errorType: metadata.errorType || metadata.errorCode || null,
  };

  // Separar metadados em categorias
  const userRelatedKeys = ['email', 'userId', 'targetUserId', 'userIdToUpdate', 'name', 'cpf', 'whatsapp'];
  const paymentRelatedKeys = ['orderId', 'asaasPaymentId', 'paymentMethod', 'totalPrice', 'finalTotal', 'originalTotal'];
  const errorRelatedKeys = ['error', 'errorMessage', 'errorType', 'errorCode', 'errorStack', 'asaasError'];
  
  const userMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => userRelatedKeys.includes(key))
  );
  
  const paymentMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => paymentRelatedKeys.includes(key))
  );
  
  const errorMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => errorRelatedKeys.includes(key))
  );
  
  const otherMetadata = Object.fromEntries(
    Object.entries(metadata).filter(([key]) => 
      !userRelatedKeys.includes(key) && 
      !paymentRelatedKeys.includes(key) && 
      !errorRelatedKeys.includes(key)
    )
  );

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
          {/* Informações Principais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informações Gerais
                </h4>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <h4 className="text-sm font-semibold text-gray-700">Mensagem</h4>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>
          </div>

          {/* Informações Extraídas */}
          {(extractedInfo.email || extractedInfo.userId || extractedInfo.orderId) && (
            <Card>
              <CardHeader className="pb-3">
                <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Informações Extraídas
                </h4>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                  {extractedInfo.email && (
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                      <Mail className="h-4 w-4 text-blue-600" />
                      <div>
                        <div className="text-gray-600">Email:</div>
                        <div className="font-medium">{extractedInfo.email}</div>
                      </div>
                    </div>
                  )}
                  {extractedInfo.userId && (
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded">
                      <User className="h-4 w-4 text-purple-600" />
                      <div>
                        <div className="text-gray-600">User ID:</div>
                        <div className="font-mono text-xs">{extractedInfo.userId}</div>
                      </div>
                    </div>
                  )}
                  {extractedInfo.orderId && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <Package className="h-4 w-4 text-green-600" />
                      <div>
                        <div className="text-gray-600">Pedido:</div>
                        <div className="font-mono text-xs">{extractedInfo.orderId}</div>
                      </div>
                    </div>
                  )}
                  {extractedInfo.asaasPaymentId && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 rounded">
                      <CreditCard className="h-4 w-4 text-yellow-600" />
                      <div>
                        <div className="text-gray-600">Pagamento:</div>
                        <div className="font-mono text-xs">{extractedInfo.asaasPaymentId}</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Metadados Categorizados */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gray-700">Metadados Detalhados</h4>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(JSON.stringify(metadata, null, 2))}
                className="text-gray-600 hover:text-gray-800"
              >
                <Copy className="h-3 w-3 mr-1" />
                Copiar JSON Completo
              </Button>
            </div>

            {/* Dados do Usuário */}
            {Object.keys(userMetadata).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <h5 className="text-sm font-medium text-blue-700 flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Dados do Usuário
                  </h5>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(userMetadata).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h6 className="text-xs font-medium text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(String(value))}
                          className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {renderMetadataValue(value, key)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Dados de Pagamento */}
            {Object.keys(paymentMetadata).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <h5 className="text-sm font-medium text-green-700 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Dados de Pagamento
                  </h5>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(paymentMetadata).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h6 className="text-xs font-medium text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(String(value))}
                          className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {renderMetadataValue(value, key)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Dados de Erro */}
            {Object.keys(errorMetadata).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <h5 className="text-sm font-medium text-red-700 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Informações de Erro
                  </h5>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(errorMetadata).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h6 className="text-xs font-medium text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(String(value))}
                          className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {renderMetadataValue(value, key)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Outros Metadados */}
            {Object.keys(otherMetadata).length > 0 && (
              <Card>
                <CardHeader className="pb-3">
                  <h5 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Outros Dados
                  </h5>
                </CardHeader>
                <CardContent className="space-y-3">
                  {Object.entries(otherMetadata).map(([key, value]) => (
                    <div key={key} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <h6 className="text-xs font-medium text-gray-700 capitalize">
                          {key.replace(/_/g, " ")}
                        </h6>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(String(value))}
                          className="text-gray-500 hover:text-gray-700 h-6 w-6 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                      {renderMetadataValue(value, key)}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Análise Automática para Erros */}
          {log.level === "error" && (
            <Card className="border-red-200">
              <CardHeader className="pb-3">
                <h4 className="text-sm font-semibold text-red-700 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Análise Automática do Erro
                </h4>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Análise baseada no contexto */}
                  {log.context.includes("auth") && (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-purple-800 mb-1">🔐 Problema de Autenticação</h5>
                      <p className="text-xs text-purple-700">
                        Este erro está relacionado ao sistema de autenticação. Verifique se:
                      </p>
                      <ul className="text-xs text-purple-700 mt-1 list-disc list-inside">
                        <li>O email está correto e válido</li>
                        <li>A senha está sendo validada corretamente</li>
                        <li>Não há duplicatas no sistema auth</li>
                      </ul>
                    </div>
                  )}

                  {log.context.includes("profile") && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-indigo-800 mb-1">👤 Problema de Perfil</h5>
                      <p className="text-xs text-indigo-700">
                        Este erro está relacionado à criação/atualização de perfil. Verifique se:
                      </p>
                      <ul className="text-xs text-indigo-700 mt-1 list-disc list-inside">
                        <li>O usuário existe no sistema auth</li>
                        <li>Os dados do perfil estão válidos</li>
                        <li>Não há conflitos de CPF ou email</li>
                      </ul>
                    </div>
                  )}

                  {log.context.includes("payment") && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-green-800 mb-1">💳 Problema de Pagamento</h5>
                      <p className="text-xs text-green-700">
                        Este erro está relacionado ao processamento de pagamento. Verifique se:
                      </p>
                      <ul className="text-xs text-green-700 mt-1 list-disc list-inside">
                        <li>As credenciais do Asaas estão configuradas</li>
                        <li>Os dados do cartão/PIX estão corretos</li>
                        <li>O valor do pagamento é válido</li>
                      </ul>
                    </div>
                  )}

                  {log.context.includes("checkout") && (
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <h5 className="text-sm font-medium text-orange-800 mb-1">🛒 Problema de Checkout</h5>
                      <p className="text-xs text-orange-700">
                        Este erro está relacionado ao processo de checkout. Verifique se:
                      </p>
                      <ul className="text-xs text-orange-700 mt-1 list-disc list-inside">
                        <li>Todos os campos obrigatórios foram preenchidos</li>
                        <li>Os produtos existem e estão ativos</li>
                        <li>O cupom (se usado) é válido</li>
                      </ul>
                    </div>
                  )}

                  {/* Ações Recomendadas */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <h5 className="text-sm font-medium text-gray-800 mb-1">🔧 Ações Recomendadas</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {extractedInfo.email && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            // Preencher o campo de timeline com o email extraído
                            const timelineTab = document.querySelector('[data-value="timeline"]') as HTMLElement;
                            if (timelineTab) {
                              timelineTab.click();
                              setTimeout(() => {
                                const emailInput = document.querySelector('input[placeholder="cliente@exemplo.com"]') as HTMLInputElement;
                                if (emailInput) {
                                  emailInput.value = extractedInfo.email!;
                                  emailInput.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                              }, 100);
                            }
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          🔍 Investigar Timeline
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(log.context)}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        📋 Copiar Contexto
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );

  function renderMetadataValue(value: any, key: string): React.ReactNode {
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
  }
};

export default LogMetadataModal;
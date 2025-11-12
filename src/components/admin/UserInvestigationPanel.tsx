"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Mail, 
  AlertTriangle, 
  CheckCircle, 
  Database, 
  CreditCard, 
  Clock,
  Copy,
  ExternalLink
} from "lucide-react";
import { showSuccess } from "@/utils/toast";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";

interface UserInvestigationResult {
  authUser: any | null;
  profile: any | null;
  orders: any[];
  recentLogs: any[];
  issues: string[];
  recommendations: string[];
}

interface UserInvestigationPanelProps {
  result: UserInvestigationResult;
  email: string;
}

const UserInvestigationPanel = ({ result, email }: UserInvestigationPanelProps) => {
  const copyToClipboard = (text: string, message: string) => {
    navigator.clipboard.writeText(text);
    showSuccess(message);
  };

  const getStatusColor = (hasIssues: boolean) => {
    return hasIssues ? "text-red-700 bg-red-50 border-red-200" : "text-green-700 bg-green-50 border-green-200";
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-800">Pago</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pendente</Badge>;
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Geral */}
      <Card className={`border-2 ${getStatusColor(result.issues.length > 0)}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.issues.length > 0 ? (
              <>
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <span className="text-red-700">Problemas Detectados</span>
              </>
            ) : (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-green-700">Usuário OK</span>
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2 text-red-700">🚨 Problemas Encontrados:</h4>
              {result.issues.length === 0 ? (
                <p className="text-green-600 text-sm">Nenhum problema detectado!</p>
              ) : (
                <ul className="space-y-1">
                  {result.issues.map((issue, index) => (
                    <li key={index} className="text-sm text-red-700 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      {issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h4 className="font-semibold mb-2 text-blue-700">💡 Recomendações:</h4>
              {result.recommendations.length === 0 ? (
                <p className="text-gray-600 text-sm">Nenhuma ação necessária.</p>
              ) : (
                <ul className="space-y-1">
                  {result.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm text-blue-700 flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dados do Auth */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Sistema de Autenticação
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.authUser ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">ID:</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{result.authUser.id}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(result.authUser.id, "ID copiado!")}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <p className="font-medium">{result.authUser.email}</p>
                </div>
                <div>
                  <span className="text-gray-600">Criado em:</span>
                  <p className="font-medium">{new Date(result.authUser.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-gray-600">Último login:</span>
                  <p className="font-medium">
                    {result.authUser.last_sign_in_at 
                      ? new Date(result.authUser.last_sign_in_at).toLocaleString()
                      : "Nunca"
                    }
                  </p>
                </div>
              </div>
              {result.authUser.user_metadata && Object.keys(result.authUser.user_metadata).length > 0 && (
                <div className="mt-4">
                  <h5 className="font-semibold text-gray-700 mb-2">Metadados do Usuário:</h5>
                  <div className="bg-gray-100 rounded p-3">
                    <pre className="text-xs text-gray-800">
                      {JSON.stringify(result.authUser.user_metadata, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-4 text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>Usuário não encontrado no sistema de autenticação</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dados do Perfil */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Perfil do Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.profile ? (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Nome:</span>
                  <p className="font-medium">{result.profile.name || "Não informado"}</p>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <p className="font-medium">{result.profile.email || "Não informado"}</p>
                </div>
                <div>
                  <span className="text-gray-600">CPF:</span>
                  <p className="font-medium">
                    {result.profile.cpf ? formatCPF(result.profile.cpf) : "Não informado"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">WhatsApp:</span>
                  <p className="font-medium">
                    {result.profile.whatsapp ? formatWhatsapp(result.profile.whatsapp) : "Não informado"}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600">Produtos com acesso:</span>
                  <p className="font-medium">{result.profile.access?.length || 0}</p>
                </div>
                <div>
                  <span className="text-gray-600">É admin:</span>
                  <Badge className={result.profile.is_admin ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}>
                    {result.profile.is_admin ? "Sim" : "Não"}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">Primeiro acesso:</span>
                  <Badge className={result.profile.primeiro_acesso ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}>
                    {result.profile.primeiro_acesso ? "Sim" : "Não"}
                  </Badge>
                </div>
                <div>
                  <span className="text-gray-600">Trocou senha:</span>
                  <Badge className={result.profile.has_changed_password ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                    {result.profile.has_changed_password ? "Sim" : "Não"}
                  </Badge>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-red-600">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
              <p>Perfil não encontrado na tabela de perfis</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Histórico de Pedidos ({result.orders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.orders.length === 0 ? (
            <div className="text-center py-4 text-gray-600">
              <p>Nenhum pedido encontrado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.orders.map((order) => (
                <div key={order.id} className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs">{order.id.substring(0, 8)}</span>
                        {getOrderStatusBadge(order.status)}
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        {new Date(order.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(order.total_price))}</p>
                      {order.asaas_payment_id && (
                        <p className="text-xs text-gray-600">
                          Asaas: {order.asaas_payment_id}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-xs text-gray-600">
                    <span>Produtos: {order.ordered_product_ids?.length || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Logs Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Logs Recentes ({result.recentLogs.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {result.recentLogs.length === 0 ? (
            <div className="text-center py-4 text-gray-600">
              <p>Nenhum log encontrado para este email</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {result.recentLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="border rounded p-2 text-xs">
                  <div className="flex justify-between items-center mb-1">
                    <Badge 
                      className={
                        log.level === 'error' ? "bg-red-100 text-red-800" :
                        log.level === 'warning' ? "bg-yellow-100 text-yellow-800" :
                        "bg-blue-100 text-blue-800"
                      }
                    >
                      {log.level.toUpperCase()}
                    </Badge>
                    <span className="text-gray-500">
                      {new Date(log.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-gray-700">{log.message}</p>
                  <p className="text-gray-500 mt-1">{log.context}</p>
                </div>
              ))}
              {result.recentLogs.length > 10 && (
                <p className="text-center text-gray-500 text-xs">
                  ... e mais {result.recentLogs.length - 10} logs
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">🔧 Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {result.authUser?.id && (
              <Button
                variant="outline"
                onClick={() => copyToClipboard(result.authUser.id, "User ID copiado!")}
                className="justify-start"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copiar User ID
              </Button>
            )}
            
            <Button
              variant="outline"
              onClick={() => copyToClipboard(email, "Email copiado!")}
              className="justify-start"
            >
              <Mail className="h-4 w-4 mr-2" />
              Copiar Email
            </Button>

            {result.profile?.cpf && (
              <Button
                variant="outline"
                onClick={() => copyToClipboard(result.profile.cpf, "CPF copiado!")}
                className="justify-start"
              >
                <User className="h-4 w-4 mr-2" />
                Copiar CPF
              </Button>
            )}

            {result.orders.length > 0 && (
              <Button
                variant="outline"
                onClick={() => copyToClipboard(
                  result.orders.map(o => o.id).join('\n'), 
                  "IDs dos pedidos copiados!"
                )}
                className="justify-start"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Copiar IDs dos Pedidos
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default UserInvestigationPanel;
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Search, AlertTriangle, CheckCircle, UserCheck, Package } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

interface OrderInfo {
  id: string;
  user_id: string;
  ordered_product_ids: string[];
  total_price: number;
  status: string;
  created_at: string;
  asaas_payment_id?: string;
}

interface UserInfo {
  id: string;
  email: string;
  email_confirmed: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

interface ProfileInfo {
  id: string;
  name: string | null;
  cpf: string | null;
  email: string | null;
  whatsapp: string | null;
  access: string[];
  has_changed_password: boolean;
  primeiro_acesso: boolean;
  is_admin: boolean;
}

const OrderAuthDebug = () => {
  const [orderId, setOrderId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [orderInfo, setOrderInfo] = useState<OrderInfo | null>(null);
  const [authUser, setAuthUser] = useState<UserInfo | null>(null);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);

  const addTestResult = (test: string, success: boolean, details?: any) => {
    setTestResults(prev => [...prev, { test, success, details, timestamp: new Date() }]);
  };

  const searchOrder = async () => {
    if (!orderId.trim()) {
      showError("ID do pedido é obrigatório");
      return;
    }

    setIsSearching(true);
    setTestResults([]);
    
    try {
      // Buscar pedido
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId.trim())
        .single();

      if (orderError || !order) {
        addTestResult("Buscar pedido", false, orderError?.message || "Pedido não encontrado");
        return;
      }

      addTestResult("Buscar pedido", true, { 
        orderId: order.id,
        userId: order.user_id,
        userEmail: "Buscando..."
      });
      setOrderInfo(order);

      // Buscar usuário auth
      const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        addTestResult("Listar usuários auth", false, listError.message);
        return;
      }

      const targetAuthUser = authUsers.users.find(u => u.id === order.user_id);
      
      if (!targetAuthUser) {
        addTestResult("Encontrar usuário auth", false, "Usuário auth não encontrado para o pedido");
        return;
      }

      addTestResult("Encontrar usuário auth", true, {
        authId: targetAuthUser.id,
        email: targetAuthUser.email,
        created_at: targetAuthUser.created_at
      });
      setAuthUser(targetAuthUser);

      // Buscar profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', order.user_id)
        .single();

      if (profileError || !profile) {
        addTestResult("Buscar profile", false, profileError?.message || "Profile não encontrado");
        return;
      }

      addTestResult("Buscar profile", true, {
        profileId: profile.id,
        email: profile.email,
        access: profile.access
      });
      setProfileInfo(profile);

      // Verificar conflito de IDs
      if (targetAuthUser.id !== profile.id) {
        addTestResult("Verificar conflito de IDs", false, {
          message: "ID do auth e profile são diferentes!",
          authId: targetAuthUser.id,
          profileId: profile.id
        });
      } else {
        addTestResult("Verificar conflito de IDs", true, "IDs estão alinhados");
      }

      // Verificar se o email do auth corresponde ao do profile
      if (targetAuthUser.email?.toLowerCase() !== profile.email?.toLowerCase()) {
        addTestResult("Verificar correspondência de emails", false, {
          message: "Email do auth e profile são diferentes!",
          authEmail: targetAuthUser.email,
          profileEmail: profile.email
        });
      } else {
        addTestResult("Verificar correspondência de emails", true, "Emails correspondem");
      }

    } catch (err: any) {
      addTestResult("Erro geral", false, err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const fixAuthProfileLink = async () => {
    if (!orderInfo || !authUser || !profileInfo) {
      showError("Busque informações do pedido primeiro");
      return;
    }

    if (!window.confirm("Tem certeza que deseja corrigir o link entre auth e profile? Isso irá atualizar o profile para usar o ID do auth.")) {
      return;
    }

    setIsLoading(true);
    try {
      // Atualizar profile para usar o ID do auth
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          id: authUser.id // Usar o ID do auth como correto
        })
        .eq('id', profileInfo.id);

      if (updateError) {
        addTestResult("Corrigir link auth-profile", false, updateError.message);
        showError("Erro ao corrigir: " + updateError.message);
      } else {
        addTestResult("Corrigir link auth-profile", true, "Profile atualizado para usar ID do auth");
        showSuccess("Link corrigido com sucesso!");
        
        // Buscar novamente para confirmar
        await searchOrder();
      }
    } catch (err: any) {
      addTestResult("Erro ao corrigir", false, err.message);
      showError("Erro inesperado: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Debug de Autenticação de Pedidos</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Investigar Pedido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">ID do Pedido</label>
            <div className="flex gap-2">
              <Input
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="UUID do pedido"
                className="flex-1"
              />
              <Button
                onClick={searchOrder}
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSearching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>

          {orderInfo && authUser && profileInfo && (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-yellow-800">Problema Identificado:</h4>
                    <p className="text-sm text-yellow-700 mt-1">
                      O pedido está vinculado a um usuário, mas pode haver conflitos entre auth e profile.
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={fixAuthProfileLink}
                disabled={isLoading}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Corrigindo...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-4 w-4 mr-2" />
                    Corrigir Link Auth-Profile
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {orderInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Dados do Pedido
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {orderInfo.id}</div>
              <div><strong>Status:</strong> {orderInfo.status}</div>
              <div><strong>Valor:</strong> R$ {orderInfo.total_price.toFixed(2)}</div>
              <div><strong>Criado:</strong> {formatDate(orderInfo.created_at)}</div>
              <div><strong>User ID:</strong> {orderInfo.user_id}</div>
              <div><strong>Produtos:</strong> {orderInfo.ordered_product_ids.join(', ')}</div>
              <div><strong>Asaas ID:</strong> {orderInfo.asaas_payment_id || '—'}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {authUser && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dados do Usuário Auth</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {authUser.id}</div>
              <div><strong>Email:</strong> {authUser.email}</div>
              <div><strong>Email Confirmado:</strong> {authUser.email_confirmed ? "Sim" : "Não"}</div>
              <div><strong>Criado:</strong> {formatDate(authUser.created_at)}</div>
              <div><strong>Último Login:</strong> {authUser.last_sign_in_at ? formatDate(authUser.last_sign_in_at) : "Nunca"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {profileInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dados do Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {profileInfo.id}</div>
              <div><strong>Nome:</strong> {profileInfo.name || "—"}</div>
              <div><strong>Email:</strong> {profileInfo.email || "—"}</div>
              <div><strong>CPF:</strong> {profileInfo.cpf || "—"}</div>
              <div><strong>WhatsApp:</strong> {profileInfo.whatsapp || "—"}</div>
              <div><strong>Primeiro Acesso:</strong> {profileInfo.primeiro_acesso ? "Sim" : "Não"}</div>
              <div><strong>Trocou Senha:</strong> {profileInfo.has_changed_password ? "Sim" : "Não"}</div>
              <div><strong>Admin:</strong> {profileInfo.is_admin ? "Sim" : "Não"}</div>
              <div className="col-span-2"><strong>Acessos:</strong> {profileInfo.access?.length || 0} produtos</div>
            </div>
          </CardContent>
        </Card>
      )}

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados da Investigação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{result.test}</div>
                    <div className="text-sm text-gray-600">
                      {typeof result.details === 'object' ? JSON.stringify(result.details, null, 2) : result.details}
                    </div>
                    <div className="text-xs text-gray-400">
                      {new Date(result.timestamp).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default OrderAuthDebug;
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

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
  has_changed_password: boolean;
  primeiro_acesso: boolean;
  is_admin: boolean;
  access: string[];
}

const UserAuthDebug = () => {
  const [email, setEmail] = useState("beranrdo.bohrer.bohnen@gmail.com");
  const [cpf, setCpf] = useState("05507462003");
  const [isLoading, setIsLoading] = useState(false);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [profileInfo, setProfileInfo] = useState<ProfileInfo | null>(null);
  const [testResults, setTestResults] = useState<any[]>([]);

  const addTestResult = (test: string, success: boolean, details?: any) => {
    setTestResults(prev => [...prev, { test, success, details, timestamp: new Date() }]);
  };

  const fetchUserInfo = async () => {
    setIsLoading(true);
    setTestResults([]);
    
    try {
      // Test 1: Listar todos os usuários e encontrar o email
      const { data: users, error: listError } = await supabase.auth.admin.listUsers();
      
      if (listError) {
        addTestResult("Listar usuários", false, listError);
        return;
      }
      
      const targetUser = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      
      if (!targetUser) {
        addTestResult("Encontrar usuário", false, "Usuário não encontrado na lista");
        return;
      }
      
      addTestResult("Encontrar usuário", true, { userId: targetUser.id, email: targetUser.email });
      setUserInfo(targetUser);

      // Test 2: Buscar perfil do usuário
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', targetUser.id)
        .single();

      if (profileError) {
        addTestResult("Buscar perfil", false, profileError);
      } else {
        addTestResult("Buscar perfil", true, profile);
        setProfileInfo(profile);
      }

      // Test 3: Verificar se o email está confirmado
      addTestResult("Email confirmado", targetUser.email_confirmed, { 
        confirmed: targetUser.email_confirmed,
        created_at: targetUser.created_at 
      });

    } catch (error: any) {
      addTestResult("Erro geral", false, error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const testLogin = async (password: string) => {
    if (!userInfo) {
      showError("Busque informações do usuário primeiro");
      return;
    }

    addTestResult(`Teste login com senha: ${password}`, false, "Iniciando teste...");

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password
      });

      if (error) {
        addTestResult(`Teste login com senha: ${password}`, false, { 
          error: error.message,
          errorType: error.name 
        });
      } else {
        addTestResult(`Teste login com senha: ${password}`, true, { 
          userId: data.user?.id,
          session: data.session ? "criada" : "nula"
        });
        
        // Fazer logout imediatamente após teste bem-sucedido
        await supabase.auth.signOut();
      }
    } catch (error: any) {
      addTestResult(`Teste login com senha: ${password}`, false, error.message);
    }
  };

  const forceUpdatePassword = async () => {
    if (!userInfo || !cpf) {
      showError("CPF não encontrado no perfil");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("force-update-password", {
        body: {
          email: email,
          newPassword: cpf.replace(/[^\d]/g, '')
        }
      });

      if (error) {
        addTestResult("Forçar atualização de senha", false, error);
        showError("Erro ao forçar atualização: " + error.message);
      } else {
        addTestResult("Forçar atualização de senha", true, data);
        showSuccess("Senha atualizada com sucesso! Tente fazer login novamente.");
      }
    } catch (error: any) {
      addTestResult("Forçar atualização de senha", false, error.message);
      showError("Erro inesperado: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Diagnóstico de Autenticação</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Informações do Usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Email do usuário</label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">CPF para teste</label>
            <Input
              value={cpf}
              onChange={(e) => setCpf(e.target.value)}
              placeholder="00000000000"
            />
          </div>
          
          <div className="flex gap-2">
            <Button 
              onClick={fetchUserInfo}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Buscar Informações"}
            </Button>
            
            {userInfo && (
              <Button 
                onClick={forceUpdatePassword}
                disabled={isLoading}
                variant="destructive"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Forçar Atualização de Senha"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {userInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dados do Usuário (Auth)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>ID:</strong> {userInfo.id}</div>
              <div><strong>Email:</strong> {userInfo.email}</div>
              <div><strong>Email Confirmado:</strong> {userInfo.email_confirmed ? "Sim" : "Não"}</div>
              <div><strong>Criado em:</strong> {new Date(userInfo.created_at).toLocaleString()}</div>
              <div><strong>Último Login:</strong> {userInfo.last_sign_in_at ? new Date(userInfo.last_sign_in_at).toLocaleString() : "Nunca"}</div>
            </div>
          </CardContent>
        </Card>
      )}

      {profileInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Dados do Perfil</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><strong>Nome:</strong> {profileInfo.name || "—"}</div>
              <div><strong>CPF:</strong> {profileInfo.cpf || "—"}</div>
              <div><strong>WhatsApp:</strong> {profileInfo.whatsapp || "—"}</div>
              <div><strong>Primeiro Acesso:</strong> {profileInfo.primeiro_acesso ? "Sim" : "Não"}</div>
              <div><strong>Trocou Senha:</strong> {profileInfo.has_changed_password ? "Sim" : "Não"}</div>
              <div><strong>Admin:</strong> {profileInfo.is_admin ? "Sim" : "Não"}</div>
              <div className="col-span-2"><strong>Acessos:</strong> {profileInfo.access?.length || 0} produtos</div>
            </div>
            
            {profileInfo.cpf && (
              <div className="mt-4 p-3 bg-gray-100 rounded">
                <p className="text-sm"><strong>CPF para teste:</strong> {profileInfo.cpf}</p>
                <p className="text-sm"><strong>CPF limpo:</strong> {profileInfo.cpf.replace(/[^\d]/g, '')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {profileInfo && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Testes de Login</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button 
                onClick={() => testLogin(profileInfo.cpf || "")}
                variant="outline"
                disabled={!profileInfo.cpf}
              >
                Testar com CPF Formatado
              </Button>
              <Button 
                onClick={() => testLogin(profileInfo.cpf?.replace(/[^\d]/g, '') || "")}
                variant="outline"
                disabled={!profileInfo.cpf}
              >
                Testar com CPF Limpo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados dos Testes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {testResults.map((result, index) => (
                <div key={index} className="flex items-start gap-3 p-3 border rounded">
                  {result.success ? (
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
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

export default UserAuthDebug;
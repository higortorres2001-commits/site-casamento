"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle, Users, Mail, Database } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";

interface DiagnosisResult {
  totalAuthUsers: number;
  totalProfiles: number;
  authWithoutProfile: number;
  profilesWithoutAuth: number;
  emailMismatches: number;
  issues: {
    authWithoutProfile: Array<{
      id: string;
      email: string;
      created_at: string;
      user_metadata: any;
    }>;
    profilesWithoutAuth: Array<{
      id: string;
      email: string;
      name: string;
      created_at: string;
    }>;
    emailMismatches: Array<{
      userId: string;
      authEmail: string;
      profileEmail: string;
    }>;
  };
  fixedCount?: number;
}

const UserDiagnosis = () => {
  const { user } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DiagnosisResult | null>(null);
  const [lastDiagnosisTime, setLastDiagnosisTime] = useState<string | null>(null);

  const isAdmin = user?.email === "higor.torres8@gmail.com";

  const runDiagnosis = async (shouldFix: boolean = false) => {
    if (!isAdmin) {
      showError("Você não tem permissão para executar este diagnóstico.");
      return;
    }

    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("diagnose-user-issues", {
        body: { action: shouldFix ? 'fix' : 'diagnose' }
      });

      if (error) {
        showError("Erro ao executar diagnóstico: " + error.message);
        console.error("Diagnosis error:", error);
        return;
      }

      if (data?.error) {
        showError(data.error);
        return;
      }

      setDiagnosis(data.diagnosis);
      setLastDiagnosisTime(new Date().toLocaleString());
      
      if (shouldFix) {
        showSuccess(`Diagnóstico e correção concluídos! ${data.diagnosis.fixedCount || 0} problemas corrigidos.`);
      } else {
        showSuccess("Diagnóstico concluído com sucesso!");
      }
    } catch (error: any) {
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Card className="max-w-md p-6 text-center">
          <p className="text-sm text-slate-600">
            Você não tem permissão para acessar esta área.
          </p>
        </Card>
      </div>
    );
  }

  const hasIssues = diagnosis && (
    diagnosis.authWithoutProfile > 0 || 
    diagnosis.profilesWithoutAuth > 0 || 
    diagnosis.emailMismatches > 0
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Diagnóstico de Usuários</h1>
          <p className="text-gray-500">Identifique e corrija problemas de sincronização entre auth e profiles</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => runDiagnosis(false)}
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Database className="h-4 w-4 mr-2" />
            )}
            Executar Diagnóstico
          </Button>
          {hasIssues && (
            <Button
              onClick={() => runDiagnosis(true)}
              disabled={isLoading}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-2" />
              )}
              Corrigir Problemas
            </Button>
          )}
        </div>
      </div>

      {lastDiagnosisTime && (
        <div className="text-sm text-gray-500">
          Último diagnóstico: {lastDiagnosisTime}
        </div>
      )}

      {diagnosis && (
        <>
          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Usuários Auth</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnosis.totalAuthUsers}</div>
                <p className="text-xs text-muted-foreground">Total no sistema de autenticação</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Perfis</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{diagnosis.totalProfiles}</div>
                <p className="text-xs text-muted-foreground">Total na tabela de perfis</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Auth Órfãos</CardTitle>
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{diagnosis.authWithoutProfile}</div>
                <p className="text-xs text-muted-foreground">Usuários auth sem perfil</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Emails Divergentes</CardTitle>
                <Mail className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{diagnosis.emailMismatches}</div>
                <p className="text-xs text-muted-foreground">Emails diferentes entre auth e profile</p>
              </CardContent>
            </Card>
          </div>

          {/* Status Geral */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {hasIssues ? (
                  <>
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    <span className="text-yellow-700">Problemas Detectados</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <span className="text-green-700">Sistema Íntegro</span>
                  </>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hasIssues ? (
                <div className="space-y-2">
                  <p className="text-gray-700">
                    Foram detectados problemas de sincronização entre o sistema de autenticação e os perfis de usuário.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {diagnosis.authWithoutProfile > 0 && (
                      <Badge variant="outline" className="text-yellow-700 border-yellow-300">
                        {diagnosis.authWithoutProfile} usuários auth sem perfil
                      </Badge>
                    )}
                    {diagnosis.profilesWithoutAuth > 0 && (
                      <Badge variant="outline" className="text-red-700 border-red-300">
                        {diagnosis.profilesWithoutAuth} perfis sem auth
                      </Badge>
                    )}
                    {diagnosis.emailMismatches > 0 && (
                      <Badge variant="outline" className="text-orange-700 border-orange-300">
                        {diagnosis.emailMismatches} emails divergentes
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-green-700">
                  Todos os usuários estão corretamente sincronizados entre o sistema de autenticação e a tabela de perfis.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Detalhes dos Problemas */}
          {hasIssues && (
            <div className="space-y-4">
              {diagnosis.issues.authWithoutProfile.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-yellow-700">
                      Usuários Auth sem Perfil ({diagnosis.issues.authWithoutProfile.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosis.issues.authWithoutProfile.map((user) => (
                        <div key={user.id} className="flex justify-between items-center p-3 bg-yellow-50 rounded border border-yellow-200">
                          <div>
                            <div className="font-medium">{user.email}</div>
                            <div className="text-sm text-gray-600">
                              ID: {user.id} • Criado: {new Date(user.created_at).toLocaleDateString()}
                            </div>
                            {user.user_metadata?.name && (
                              <div className="text-sm text-gray-600">Nome: {user.user_metadata.name}</div>
                            )}
                          </div>
                          <Badge variant="outline" className="text-yellow-700">Sem Perfil</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {diagnosis.issues.profilesWithoutAuth.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-red-700">
                      Perfis sem Auth ({diagnosis.issues.profilesWithoutAuth.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosis.issues.profilesWithoutAuth.map((profile) => (
                        <div key={profile.id} className="flex justify-between items-center p-3 bg-red-50 rounded border border-red-200">
                          <div>
                            <div className="font-medium">{profile.name || profile.email}</div>
                            <div className="text-sm text-gray-600">
                              ID: {profile.id} • Email: {profile.email}
                            </div>
                          </div>
                          <Badge variant="outline" className="text-red-700">Sem Auth</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {diagnosis.issues.emailMismatches.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg text-orange-700">
                      Emails Divergentes ({diagnosis.issues.emailMismatches.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {diagnosis.issues.emailMismatches.map((mismatch) => (
                        <div key={mismatch.userId} className="p-3 bg-orange-50 rounded border border-orange-200">
                          <div className="font-medium">ID: {mismatch.userId}</div>
                          <div className="text-sm text-gray-600">
                            Auth: {mismatch.authEmail} → Profile: {mismatch.profileEmail}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </>
      )}

      {!diagnosis && (
        <Card>
          <CardContent className="text-center py-8">
            <Database className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">
              Execute um diagnóstico para verificar a integridade dos dados de usuários.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default UserDiagnosis;
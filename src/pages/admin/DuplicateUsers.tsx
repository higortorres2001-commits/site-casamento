"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, AlertTriangle, CheckCircle, Trash2, UserCheck } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

interface DuplicateUser {
  email: string;
  users: Array<{
    id: string;
    email: string;
    created_at: string;
    last_sign_in_at: string | null;
    user_metadata: any;
  }>;
  profiles: Array<{
    id: string;
    name: string | null;
    cpf: string | null;
    email: string | null;
    whatsapp: string | null;
    access: string[];
  }>;
  profileError?: any;
}

const DuplicateUsers = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [isFixing, setIsFixing] = useState<string | null>(null);

  const searchDuplicates = async () => {
    setIsSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke("find-duplicate-users");
      
      if (error) {
        showError("Erro ao buscar duplicatas: " + error.message);
        console.error("Search duplicates error:", error);
      } else {
        setTotalUsers(data.totalUsers || 0);
        setDuplicates(data.duplicates || []);
        showSuccess(`Encontradas ${data.duplicateCount} duplicatas em ${data.totalUsers} usuários`);
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const fixDuplicate = async (email: string, keepUserId: string) => {
    if (!window.confirm(`Tem certeza que deseja manter o usuário ${keepUserId} e deletar os outros com o email ${email}?`)) {
      return;
    }

    setIsFixing(email);
    try {
      const { data, error } = await supabase.functions.invoke("fix-duplicate-users", {
        body: { email, keepUserId }
      });
      
      if (error) {
        showError("Erro ao corrigir duplicatas: " + error.message);
        console.error("Fix duplicates error:", error);
      } else {
        showSuccess("Duplicatas corrigidas com sucesso!");
        // Recarregar a lista
        searchDuplicates();
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
    } finally {
      setIsFixing(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR');
  };

  const getUserStatus = (user: any) => {
    if (user.last_sign_in_at) {
      return { text: "Ativo", color: "text-green-600" };
    }
    return { text: "Nunca logou", color: "text-gray-500" };
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="h-6 w-6" />
          <h1 className="text-3xl font-bold">Gerenciar Usuários Duplicados</h1>
        </div>
        <Button
          onClick={searchDuplicates}
          disabled={isSearching}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          {isSearching ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Buscando...
            </>
          ) : (
            <>
              <Users className="h-4 w-4 mr-2" />
              Buscar Duplicatas
            </>
          )}
        </Button>
      </div>

      {totalUsers > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-blue-600" />
            <div>
              <p className="text-sm text-blue-800">
                <strong>Atenção:</strong> Encontrados {totalUsers} usuários no sistema.
                Duplicatas podem causar problemas de login e integridade de dados.
              </p>
            </div>
          </div>
        </div>
      )}

      {duplicates.length === 0 && !isSearching && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-green-800 mb-2">Nenhuma Duplicata Encontrada</h3>
            <p className="text-gray-600">
              Não há usuários duplicados no sistema. Todos os emails são únicos.
            </p>
          </CardContent>
        </Card>
      )}

      {duplicates.length > 0 && (
        <div className="space-y-6">
          {duplicates.map((duplicate, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Duplicata: {duplicate.email}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Lista de usuários duplicados */}
                  <div>
                    <h4 className="font-semibold mb-3">Usuários Auth ({duplicate.users.length})</h4>
                    <div className="space-y-2">
                      {duplicate.users.map((user, userIndex) => {
                        const status = getUserStatus(user);
                        return (
                          <div key={user.id} className="border rounded-md p-3 bg-gray-50">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-medium">ID: {user.id.substring(0, 8)}...</span>
                                  <span className={`text-sm ${status.color}`}>{status.text}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                  Criado: {formatDate(user.created_at)}
                                </div>
                                {user.user_metadata?.name && (
                                  <div className="text-sm">
                                    Nome: {user.user_metadata.name}
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => fixDuplicate(duplicate.email, user.id)}
                                  disabled={isFixing === duplicate.email}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  {isFixing === duplicate.email ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="h-3 w-3" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => fixDuplicate(duplicate.email, user.id)}
                                  disabled={isFixing === duplicate.email}
                                >
                                  {isFixing === duplicate.email ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Profiles correspondentes */}
                  {duplicate.profiles.length > 0 && (
                    <div>
                      <h4 className="font-semibold mb-3">Profiles Correspondentes</h4>
                      <div className="space-y-2">
                        {duplicate.profiles.map((profile) => (
                          <div key={profile.id} className="border rounded-md p-3 bg-yellow-50">
                            <div className="text-sm">
                              <div><strong>ID:</strong> {profile.id.substring(0, 8)}...</div>
                              <div><strong>Nome:</strong> {profile.name || "—"}</div>
                              <div><strong>CPF:</strong> {profile.cpf || "—"}</div>
                              <div><strong>WhatsApp:</strong> {profile.whatsapp || "—"}</div>
                              <div><strong>Acessos:</strong> {profile.access?.length || 0} produtos</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {duplicate.profileError && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                      <p className="text-sm text-red-800">
                        <strong>Erro ao buscar profiles:</strong> {duplicate.profileError.message}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default DuplicateUsers;
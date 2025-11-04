"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCheck, AlertTriangle } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const FixMissingAuth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [profileId, setProfileId] = useState("");
  const [profileData, setProfileData] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const searchProfile = async () => {
    if (!profileId.trim()) {
      showError("ID do profile é obrigatório");
      return;
    }

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', profileId.trim())
        .single();

      if (error || !data) {
        showError("Profile não encontrado");
        setProfileData(null);
      } else {
        setProfileData(data);
        showSuccess("Profile encontrado!");
      }
    } catch (err: any) {
      showError("Erro ao buscar profile: " + err.message);
    } finally {
      setIsSearching(false);
    }
  };

  const fixAuth = async () => {
    if (!profileId.trim()) {
      showError("ID do profile é obrigatório");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("fix-missing-auth", {
        body: { profileId: profileId.trim() }
      });

      if (error) {
        showError("Erro ao corrigir auth: " + error.message);
        console.error("Fix auth error:", error);
      } else {
        if (data.error) {
          showError(data.error);
        } else {
          showSuccess("Usuário auth criado com sucesso!");
          setProfileData(null);
          setProfileId("");
        }
      }
    } catch (err: any) {
      showError("Erro inesperado: " + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserCheck className="h-5 w-5" />
            Corrigir Usuário Sem Auth
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800">Quando usar esta ferramenta?</h4>
                <p className="text-sm text-yellow-700 mt-1">
                  Use quando o cliente existe na tabela profiles mas não aparece na lista de usuários auth.
                  Isso pode acontecer quando o auth foi deletado ou falhou na criação.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">ID do Profile</label>
              <div className="flex gap-2">
                <Input
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="UUID do profile"
                  className="flex-1"
                />
                <Button
                  onClick={searchProfile}
                  disabled={isSearching}
                  variant="outline"
                >
                  {isSearching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Buscar"
                  )}
                </Button>
              </div>
            </div>

            {profileData && (
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <h4 className="font-semibold text-green-800 mb-2">Profile Encontrado:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>ID:</strong> {profileData.id}</div>
                  <div><strong>Nome:</strong> {profileData.name || "—"}</div>
                  <div><strong>Email:</strong> {profileData.email || "—"}</div>
                  <div><strong>CPF:</strong> {profileData.cpf || "—"}</div>
                  <div><strong>WhatsApp:</strong> {profileData.whatsapp || "—"}</div>
                  <div><strong>Acessos:</strong> {profileData.access?.length || 0} produtos</div>
                </div>
              </div>
            )}

            <Button
              onClick={fixAuth}
              disabled={isLoading || !profileData}
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
                  Criar Usuário Auth
                </>
              )}
            </Button>
          </div>

          <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">
            <p className="font-medium mb-2">O que esta ferramenta faz:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Busca o profile pelo ID</li>
              <li>Verifica se não existe usuário auth</li>
              <li>Cria usuário auth usando CPF como senha</li>
              <li>Atualiza flags do profile</li>
              <li>Envia email de acesso liberado</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FixMissingAuth;
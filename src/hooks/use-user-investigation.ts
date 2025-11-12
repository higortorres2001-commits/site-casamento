"use client";

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { showError, showSuccess } from '@/utils/toast';

interface UserInvestigationResult {
  authUser: any | null;
  profile: any | null;
  orders: any[];
  recentLogs: any[];
  issues: string[];
  recommendations: string[];
}

export const useUserInvestigation = () => {
  const [isInvestigating, setIsInvestigating] = useState(false);
  const [investigationResult, setInvestigationResult] = useState<UserInvestigationResult | null>(null);

  const investigateUser = useCallback(async (email: string) => {
    if (!email || !email.includes('@')) {
      showError("Por favor, insira um email válido.");
      return;
    }

    setIsInvestigating(true);
    
    try {
      // 1. Buscar usuário no auth
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();
      
      if (authError) {
        showError("Erro ao buscar usuários auth: " + authError.message);
        return;
      }

      const authUser = authUsers.users.find((u: any) => 
        u.email?.toLowerCase() === email.toLowerCase().trim()
      );

      // 2. Buscar perfil
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', email.toLowerCase().trim())
        .single();

      // 3. Buscar pedidos (se tiver userId)
      let orders: any[] = [];
      if (authUser?.id) {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', authUser.id)
          .order('created_at', { ascending: false });
        
        if (!ordersError && ordersData) {
          orders = ordersData;
        }
      }

      // 4. Buscar logs recentes relacionados ao email
      const { data: logsData, error: logsError } = await supabase
        .from('logs')
        .select('*')
        .or(`metadata->>email.ilike.%${email.toLowerCase()}%,message.ilike.%${email.toLowerCase()}%`)
        .order('created_at', { ascending: false })
        .limit(50);

      const recentLogs = logsError ? [] : (logsData || []);

      // 5. Analisar problemas
      const issues: string[] = [];
      const recommendations: string[] = [];

      if (!authUser && !profile) {
        issues.push("Usuário não existe no sistema");
        recommendations.push("Verificar se o email está correto");
      } else if (authUser && !profile) {
        issues.push("Usuário existe no auth mas não tem perfil");
        recommendations.push("Executar diagnóstico de usuários para corrigir");
      } else if (authUser && profile) {
        // Verificar inconsistências
        if (authUser.email?.toLowerCase() !== profile.email?.toLowerCase()) {
          issues.push("Email divergente entre auth e profile");
          recommendations.push("Sincronizar emails usando diagnóstico");
        }
        
        if (profile.access && profile.access.length === 0 && orders.some((o: any) => o.status === 'paid')) {
          issues.push("Cliente pagou mas não tem acesso aos produtos");
          recommendations.push("Verificar webhook do Asaas e atualizar acesso manualmente");
        }
        
        if (profile.primeiro_acesso === true && profile.has_changed_password === false) {
          issues.push("Cliente não trocou a senha do primeiro acesso");
          recommendations.push("Orientar cliente a trocar senha ou resetar para CPF");
        }
      }

      // Analisar logs para problemas específicos
      const errorLogs = recentLogs.filter((log: any) => log.level === 'error');
      if (errorLogs.length > 0) {
        issues.push(`${errorLogs.length} erros encontrados nos logs recentes`);
        recommendations.push("Verificar detalhes dos erros na aba de logs");
      }

      const result: UserInvestigationResult = {
        authUser,
        profile: profileError ? null : profile,
        orders,
        recentLogs,
        issues,
        recommendations
      };

      setInvestigationResult(result);
      showSuccess(`Investigação concluída para ${email}. ${issues.length} problemas encontrados.`);

    } catch (error: any) {
      showError("Erro durante investigação: " + error.message);
      console.error("Investigation error:", error);
    } finally {
      setIsInvestigating(false);
    }
  }, []);

  const clearInvestigation = useCallback(() => {
    setInvestigationResult(null);
  }, []);

  return {
    investigateUser,
    clearInvestigation,
    isInvestigating,
    investigationResult
  };
};
"use client";

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, RefreshCw } from 'lucide-react';

const SessionError = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Tentar limpar qualquer estado de sessão corrompido
    const clearSession = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');
        await supabase.auth.signOut({ scope: 'global' });
      } catch (error) {
        console.error('Error clearing session:', error);
      }
    };
    
    clearSession();
  }, [navigate]);

  const handleGoToLogin = () => {
    // Forçar reload completo da aplicação para limpar qualquer estado
    window.location.href = '/login';
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
            <AlertTriangle className="h-6 w-6 text-orange-600" />
          </div>
          <CardTitle className="text-xl text-gray-800">
            Erro de Sessão
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">
            Ocorreu um problema com sua sessão. Isso pode acontecer quando:
          </p>
          <ul className="text-sm text-gray-500 text-left space-y-1">
            <li>• Sua sessão expirou</li>
            <li>• Há múltiplas abas abertas</li>
            <li>• Ocorreu um erro de conexão</li>
          </ul>
          
          <div className="space-y-2 pt-4">
            <Button 
              onClick={handleGoToLogin}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white"
            >
              Ir para o Login
            </Button>
            
            <Button 
              variant="outline"
              onClick={handleReload}
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar Página
            </Button>
          </div>
          
          <p className="text-xs text-gray-400 pt-2">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default SessionError;
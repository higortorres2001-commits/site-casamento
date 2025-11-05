"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface SessionContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Refs para armazenar os valores mais recentes
  const latestSessionRef = useRef<Session | null>(null);
  const latestUserRef = useRef<User | null>(null);

  // Efeito para manter os refs atualizados
  useEffect(() => {
    latestSessionRef.current = session;
    latestUserRef.current = user;
  }, [session, user]);

  useEffect(() => {
    const publicPaths = [
      '/login',
      '/checkout/',
      '/confirmacao',
      '/processando-pagamento',
      '/primeira-senha',
      '/update-password',
    ];

    const isPublicPath = publicPaths.some(path => 
      path.endsWith('/') ? location.pathname.startsWith(path) : location.pathname === path
    );

    console.log('SessionContextProvider - Current path:', location.pathname);
    console.log('SessionContextProvider - Is public path:', isPublicPath);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('SessionContextProvider - Auth state change:', {
          event,
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          userEmail: currentSession?.user?.email
        });

        // Usar os valores mais recentes dos refs para a comparação
        const currentSessionState = latestSessionRef.current;
        const currentUserState = latestUserRef.current;

        // Verifica se a sessão ou o usuário realmente mudaram
        const hasSessionChanged = 
          currentSession?.user?.id !== currentUserState?.id || 
          currentSession?.expires_at !== currentSessionState?.expires_at ||
          (currentSession === null && currentSessionState !== null) ||
          (currentSession !== null && currentSessionState === null);

        if (hasSessionChanged) {
          console.log('SessionContextProvider - Session changed, updating state');
          setSession(currentSession);
          setUser(currentSession?.user || null);
        } else {
          console.log('SessionContextProvider - Session unchanged, skipping state update');
        }
        
        setIsLoading(false);

        // Tratamento específico para eventos de autenticação
        if (event === 'SIGNED_OUT') {
          console.log('SessionContextProvider - User signed out');
          if (!isPublicPath) {
            console.log('SessionContextProvider - Redirecting to login after sign out');
            navigate('/login');
          } else {
            console.log('SessionContextProvider - On public path, not redirecting');
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession && location.pathname === '/login') {
            console.log('SessionContextProvider - Redirecting from login after sign in');
            navigate('/meus-produtos');
          }
        } else if (event === 'TOKEN_REFRESHED') {
          console.log('SessionContextProvider - Token refreshed successfully');
        }
      }
    );

    // Verificação inicial da sessão
    const checkInitialSession = async () => {
      try {
        console.log('SessionContextProvider - Checking initial session...');
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('SessionContextProvider - Error checking initial session:', error);
          setSession(null);
          setUser(null);
        } else {
          console.log('SessionContextProvider - Initial session result:', {
            hasSession: !!initialSession,
            userId: initialSession?.user?.id
          });
          
          // Aplica a mesma lógica de detecção de mudança
          const currentSessionState = latestSessionRef.current;
          const hasInitialSessionChanged = 
            initialSession?.user?.id !== currentSessionState?.user?.id || 
            initialSession?.expires_at !== currentSessionState?.expires_at ||
            (initialSession === null && currentSessionState !== null) ||
            (initialSession !== null && currentSessionState === null);

          if (hasInitialSessionChanged) {
            setSession(initialSession);
            setUser(initialSession?.user || null);
          }
        }
      } catch (error) {
        console.error('SessionContextProvider - Unexpected error checking session:', error);
        setSession(null);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkInitialSession();

    return () => {
      console.log('SessionContextProvider - Cleaning up auth listener');
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  return (
    <SessionContext.Provider value={{ session, user, isLoading }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};
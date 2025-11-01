"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation

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
  const location = useLocation(); // Use useLocation hook

  // Refs para armazenar os valores mais recentes de session e user
  const latestSessionRef = useRef<Session | null>(null);
  const latestUserRef = useRef<User | null>(null);

  // Efeito para manter os refs atualizados com os estados mais recentes
  useEffect(() => {
    latestSessionRef.current = session;
    latestUserRef.current = user;
  }, [session, user]);

  const checkProfileAndRedirect = async (currentUser: User | null, currentPath: string) => {
    if (!currentUser) return;

    const requiresPasswordUpdate = currentPath === '/primeira-senha';
    const isPublicPath = [
      '/login',
      '/checkout/',
      '/confirmacao',
      '/processando-pagamento',
      '/primeira-senha',
      '/update-password',
    ].some(path => 
      path.endsWith('/') ? currentPath.startsWith(path) : currentPath === path
    );

    // Se já estiver na página de troca de senha, não redirecionar
    if (requiresPasswordUpdate) return;

    // Verifica o status has_changed_password no perfil
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('has_changed_password')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      console.error("Error fetching profile for password check:", error);
      return;
    }

    if (profile && profile.has_changed_password === false) {
      console.log('SessionContextProvider: User requires password update. Redirecting to /primeira-senha.');
      navigate('/primeira-senha');
    } else if (currentUser && currentPath === '/login') {
      // Se estiver logado e na página de login, redireciona para produtos
      navigate('/meus-produtos');
    }
  };

  useEffect(() => {
    const publicPaths = [
      '/login',
      '/checkout/', // Dynamic path, check with startsWith
      '/confirmacao',
      '/processando-pagamento',
      '/primeira-senha', // Adicionado como rota pública
      '/update-password', // Adicionado como rota pública
    ];

    const isPublicPath = publicPaths.some(path => 
      path.endsWith('/') ? location.pathname.startsWith(path) : location.pathname === path
    );

    console.log('SessionContextProvider DEBUG: Current path:', location.pathname);
    console.log('SessionContextProvider DEBUG: Is public path:', isPublicPath);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('SessionContextProvider DEBUG: Auth state change event:', event, 'Session:', currentSession ? 'exists' : 'null', 'User object reference:', currentSession?.user);

        const currentSessionState = latestSessionRef.current;
        const currentUserState = latestUserRef.current;

        const hasSessionChanged = 
          currentSession?.user?.id !== currentUserState?.id || 
          currentSession?.expires_at !== currentSessionState?.expires_at ||
          (currentSession === null && currentSessionState !== null) ||
          (currentSession !== null && currentSessionState === null);

        if (hasSessionChanged) {
          setSession(currentSession);
          setUser(currentSession?.user || null);
          console.log('SessionContextProvider DEBUG: State updated due to session change.');
        } else {
          console.log('SessionContextProvider DEBUG: Session state unchanged, skipping state update.');
        }
        setIsLoading(false);

        if (event === 'SIGNED_OUT') {
          if (!isPublicPath) {
            console.log('SessionContextProvider DEBUG: SIGNED_OUT, not public path. Redirecting to /login.');
            navigate('/login');
          } else {
            console.log('SessionContextProvider DEBUG: SIGNED_OUT, on public path. Not redirecting.');
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'PASSWORD_RECOVERY') {
          if (currentSession?.user) {
            // Verifica se precisa trocar a senha após login/recuperação
            await checkProfileAndRedirect(currentSession.user, location.pathname);
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContextProvider DEBUG: Initial session check. Session:', initialSession ? 'exists' : 'null', 'User object reference:', initialSession?.user);
      
      const currentSessionState = latestSessionRef.current;
      const currentUserState = latestUserRef.current;
      const hasInitialSessionChanged = 
        initialSession?.user?.id !== currentUserState?.id || 
        initialSession?.expires_at !== currentSessionState?.expires_at ||
        (initialSession === null && currentSessionState !== null) ||
        (initialSession !== null && currentSessionState === null);

      if (hasInitialSessionChanged) {
        setSession(initialSession);
        setUser(initialSession?.user || null);
        console.log('SessionContextProvider DEBUG: Initial state updated due to session change.');
      } else {
        console.log('SessionContextProvider DEBUG: Initial session state unchanged, skipping state update.');
      }
      setIsLoading(false);

      if (initialSession) {
        // Verifica se precisa trocar a senha após a sessão inicial
        await checkProfileAndRedirect(initialSession.user, location.pathname);
      } else if (!isPublicPath) {
        console.log('SessionContextProvider DEBUG: No initial session and not public path. Redirecting to /login.');
        navigate('/login');
      } else {
        console.log('SessionContextProvider DEBUG: No initial session, but on public path. Not redirecting.');
      }
    });

    return () => {
      console.log('SessionContextProvider DEBUG: Unsubscribing from auth listener.');
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
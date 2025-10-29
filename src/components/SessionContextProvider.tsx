"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation
import { Profile } from '@/types'; // Import Profile type

// Estendendo o tipo User do Supabase para incluir dados do perfil
interface CustomUser extends User {
  is_admin?: boolean | null;
  name?: string | null;
  cpf?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  access?: string[] | null;
  primeiro_acesso?: boolean | null;
  has_changed_password?: boolean | null;
}

interface SessionContextType {
  session: Session | null;
  user: CustomUser | null;
  isLoading: boolean;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<CustomUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation(); // Use useLocation hook

  // Refs para armazenar os valores mais recentes de session e user
  const latestSessionRef = useRef<Session | null>(null);
  const latestUserRef = useRef<CustomUser | null>(null);

  // Efeito para manter os refs atualizados com os estados mais recentes
  useEffect(() => {
    latestSessionRef.current = session;
    latestUserRef.current = user;
  }, [session, user]);

  const fetchUserProfile = async (userId: string): Promise<Partial<Profile> | null> => {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin, name, cpf, email, whatsapp, access, primeiro_acesso, has_changed_password')
      .eq('id', userId)
      .single();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }
    return data;
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

        let updatedUser: CustomUser | null = null;
        if (currentSession?.user) {
          const profileData = await fetchUserProfile(currentSession.user.id);
          updatedUser = { ...currentSession.user, ...profileData };
          console.log('SessionContextProvider DEBUG: Fetched profile data:', profileData);
          console.log('SessionContextProvider DEBUG: Merged user object:', updatedUser);
        }

        // Use os valores mais recentes dos refs para a comparação
        const currentSessionState = latestSessionRef.current;
        const currentUserState = latestUserRef.current;

        // Verifica se a sessão ou o usuário realmente mudaram
        const hasSessionChanged = 
          updatedUser?.id !== currentUserState?.id || 
          currentSession?.expires_at !== currentSessionState?.expires_at ||
          updatedUser?.is_admin !== currentUserState?.is_admin || // Check for admin status change
          (currentSession === null && currentSessionState !== null) || // Detecta logout
          (currentSession !== null && currentSessionState === null); // Detecta login

        if (hasSessionChanged) {
          setSession(currentSession);
          setUser(updatedUser);
          console.log('SessionContextProvider DEBUG: State updated due to session change. New user.is_admin:', updatedUser?.is_admin);
        } else {
          console.log('SessionContextProvider DEBUG: Session state unchanged, skipping state update.');
        }
        setIsLoading(false);
        console.log('SessionContextProvider DEBUG: setIsLoading(false) called.');

        if (event === 'SIGNED_OUT') {
          if (!isPublicPath) { // Only redirect if not on a public path
            console.log('SessionContextProvider DEBUG: SIGNED_OUT, not public path. Redirecting to /login.');
            navigate('/login');
          } else {
            console.log('SessionContextProvider DEBUG: SIGNED_OUT, on public path. Not redirecting.');
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession && location.pathname === '/login') {
            console.log('SessionContextProvider DEBUG: SIGNED_IN/INITIAL_SESSION, on /login. Redirecting to /meus-produtos.');
            navigate('/meus-produtos');
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      console.log('SessionContextProvider DEBUG: Initial session check. Session:', initialSession ? 'exists' : 'null', 'User object reference:', initialSession?.user);
      
      let initialUpdatedUser: CustomUser | null = null;
      if (initialSession?.user) {
        const profileData = await fetchUserProfile(initialSession.user.id);
        initialUpdatedUser = { ...initialSession.user, ...profileData };
        console.log('SessionContextProvider DEBUG: Initial fetched profile data:', profileData);
        console.log('SessionContextProvider DEBUG: Initial merged user object:', initialUpdatedUser);
      }

      // Aplica a mesma lógica de detecção de mudança para a sessão inicial
      const currentSessionState = latestSessionRef.current;
      const currentUserState = latestUserRef.current;
      const hasInitialSessionChanged = 
        initialUpdatedUser?.id !== currentUserState?.id || 
        initialSession?.expires_at !== currentSessionState?.expires_at ||
        initialUpdatedUser?.is_admin !== currentUserState?.is_admin ||
        (initialSession === null && currentSessionState !== null) ||
        (initialSession !== null && currentSessionState === null);

      if (hasInitialSessionChanged) {
        setSession(initialSession);
        setUser(initialUpdatedUser);
        console.log('SessionContextProvider DEBUG: Initial state updated due to session change. New user.is_admin:', initialUpdatedUser?.is_admin);
      } else {
        console.log('SessionContextProvider DEBUG: Initial session state unchanged, skipping state update.');
      }
      setIsLoading(false);
      console.log('SessionContextProvider DEBUG: Initial setIsLoading(false) called.');

      // If no session and not on a public path, redirect to login
      if (!initialSession && !isPublicPath) {
        console.log('SessionContextProvider DEBUG: No initial session and not public path. Redirecting to /login.');
        navigate('/login');
      } else if (initialSession) {
        console.log('SessionContextProvider DEBUG: Initial session exists for user:', initialSession.user.email);
      } else {
        console.log('SessionContextProvider DEBUG: No initial session, but on public path. Not redirecting.');
      }
    });

    return () => {
      console.log('SessionContextProvider DEBUG: Unsubscribing from auth listener.');
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]); // As dependências deste useEffect são apenas navigate e location.pathname
                                    // session e user são acessados via refs para evitar loops de re-renderização.

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
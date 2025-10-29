"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';
import { Profile } from '@/types';

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
  const location = useLocation();

  const latestSessionRef = useRef<Session | null>(null);
  const latestUserRef = useRef<CustomUser | null>(null);

  useEffect(() => {
    latestSessionRef.current = session;
    latestUserRef.current = user;
  }, [session, user]);

  const fetchUserProfile = async (userId: string): Promise<Partial<Profile> | null> => {
    console.log('SessionContextProvider DEBUG: fetchUserProfile called for userId:', userId);
    try {
      console.log('SessionContextProvider DEBUG: Executing Supabase profile query...'); 
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin, name, cpf, email, whatsapp, access, primeiro_acesso, has_changed_password')
        .eq('id', userId)
        .single();

      console.log('SessionContextProvider DEBUG: Supabase query resolved. Data:', data, 'Error:', error);

      if (error) {
        console.error("SessionContextProvider DEBUG: Error fetching user profile:", error);
        return null;
      }
      console.log('SessionContextProvider DEBUG: Raw profile data fetched:', data);
      console.log('SessionContextProvider DEBUG: is_admin from profile data:', data?.is_admin); // NOVO LOG AQUI
      return data;
    } catch (catchError: any) {
      console.error("SessionContextProvider DEBUG: Uncaught error in fetchUserProfile:", catchError);
      return null;
    }
  };

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

    console.log('SessionContextProvider DEBUG: Current path:', location.pathname);
    console.log('SessionContextProvider DEBUG: Is public path:', isPublicPath);

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('SessionContextProvider DEBUG: Auth state change event:', event, 'Session:', currentSession ? 'exists' : 'null', 'User object reference:', currentSession?.user);

        let updatedUser: CustomUser | null = null;
        if (currentSession?.user) {
          const profileData = await fetchUserProfile(currentSession.user.id);
          updatedUser = { ...currentSession.user, ...(profileData || {}) };
          console.log('SessionContextProvider DEBUG: Fetched profile data:', profileData);
          console.log('SessionContextProvider DEBUG: Merged user object:', updatedUser);
          console.log('SessionContextProvider DEBUG: Merged user.is_admin:', updatedUser?.is_admin); // NOVO LOG AQUI
        }

        const currentSessionState = latestSessionRef.current;
        const currentUserState = latestUserRef.current;

        const hasSessionChanged =
          updatedUser?.id !== currentUserState?.id ||
          currentSession?.expires_at !== currentSessionState?.expires_at ||
          updatedUser?.is_admin !== currentUserState?.is_admin ||
          (currentSession === null && currentSessionState !== null) ||
          (currentSession !== null && currentSessionState === null);

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
          if (!isPublicPath) {
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
        initialUpdatedUser = { ...initialSession.user, ...(profileData || {}) };
        console.log('SessionContextProvider DEBUG: Initial fetched profile data:', profileData);
        console.log('SessionContextProvider DEBUG: Initial merged user object:', initialUpdatedUser);
        console.log('SessionContextProvider DEBUG: Initial merged user.is_admin:', initialUpdatedUser?.is_admin); // NOVO LOG AQUI
      }

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
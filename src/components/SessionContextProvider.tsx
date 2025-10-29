"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
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
        console.log('SessionContextProvider DEBUG: Auth state change event:', event, 'Session:', currentSession ? 'exists' : 'null');
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setIsLoading(false);

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

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      console.log('SessionContextProvider DEBUG: Initial session check. Session:', initialSession ? 'exists' : 'null');
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setIsLoading(false);
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
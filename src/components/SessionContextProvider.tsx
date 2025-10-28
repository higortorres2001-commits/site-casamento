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
    ];

    const isPublicPath = publicPaths.some(path => 
      path.endsWith('/') ? location.pathname.startsWith(path) : location.pathname === path
    );

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user || null);
        setIsLoading(false);

        if (event === 'SIGNED_OUT') {
          if (!isPublicPath) { // Only redirect if not on a public path
            navigate('/login');
          }
        } else if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          if (currentSession && location.pathname === '/login') {
            navigate('/');
          }
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user || null);
      setIsLoading(false);
      // If no session and not on a public path, redirect to login
      if (!initialSession && !isPublicPath) {
        navigate('/login');
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]); // Add location.pathname to dependencies

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
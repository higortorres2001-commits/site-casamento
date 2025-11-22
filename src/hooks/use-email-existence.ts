import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseEmailExistenceReturn {
  checkEmailExists: (email: string) => Promise<boolean>;
  isChecking: boolean;
  emailExists: boolean | null;
  error: string | null;
}

// ✅ Cache simples para evitar verificações duplicadas
const emailCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

export const useEmailExistence = (): UseEmailExistenceReturn => {
  const [isChecking, setIsChecking] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    // Validações mais robustas
    if (!email || !email.includes('@')) {
      setEmailExists(null);
      setError(null);
      return false;
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ✅ Verificar cache primeiro
    const cached = emailCache.get(normalizedEmail);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      console.log("📦 Using cached email check result:", normalizedEmail);
      setEmailExists(cached.exists);
      return cached.exists;
    }

    // ✅ Cancelar requisição anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setIsChecking(true);
    setError(null);
    setEmailExists(null);

    try {
      console.log("🔍 Checking email existence:", normalizedEmail);
      
      const { data, error: functionError } = await supabase.functions.invoke("check-user-exists", {
        body: { email: normalizedEmail }
      });

      if (functionError) {
        console.error("Error checking email existence:", functionError);
        setError("Erro ao verificar e-mail. Tente novamente.");
        setEmailExists(null);
        return false;
      }

      console.log("📧 Email existence result:", data);
      
      const exists = data?.exists || false;
      
      // ✅ Salvar no cache
      emailCache.set(normalizedEmail, {
        exists,
        timestamp: Date.now()
      });
      
      setEmailExists(exists);
      return exists;
      
    } catch (error: any) {
      // ✅ Ignorar erros de abort
      if (error.name === 'AbortError') {
        console.log("Email check aborted");
        return false;
      }
      
      console.error("Unexpected error checking email:", error);
      setError("Erro inesperado. Tente novamente.");
      setEmailExists(null);
      return false;
    } finally {
      setIsChecking(false);
      abortControllerRef.current = null;
    }
  }, []);

  return {
    checkEmailExists,
    isChecking,
    emailExists,
    error
  };
};
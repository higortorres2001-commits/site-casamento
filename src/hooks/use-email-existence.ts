import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UseEmailExistenceReturn {
  checkEmailExists: (email: string) => Promise<boolean>;
  isChecking: boolean;
  emailExists: boolean | null;
  error: string | null;
}

export const useEmailExistence = (): UseEmailExistenceReturn => {
  const [isChecking, setIsChecking] = useState(false);
  const [emailExists, setEmailExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkEmailExists = useCallback(async (email: string): Promise<boolean> => {
    // Validações mais robustas
    if (!email || !email.includes('@')) {
      setEmailExists(null);
      setError(null);
      return false;
    }

    // Reset states antes de iniciar verificação
    setIsChecking(true);
    setError(null);
    setEmailExists(null);

    try {
      console.log("🔍 Checking email existence:", email);
      
      const { data, error: functionError } = await supabase.functions.invoke("check-user-exists", {
        body: { email: email.toLowerCase().trim() }
      });

      if (functionError) {
        console.error("Error checking email existence:", functionError);
        setError("Erro ao verificar e-mail. Tente novamente.");
        setEmailExists(null);
        return false;
      }

      console.log("📧 Email existence result:", data);
      
      const exists = data?.exists || false;
      setEmailExists(exists);
      return exists;
      
    } catch (error: any) {
      console.error("Unexpected error checking email:", error);
      setError("Erro inesperado. Tente novamente.");
      setEmailExists(null);
      return false;
    } finally {
      // Garantir que isChecking seja false após a verificação
      setIsChecking(false);
    }
  }, []);

  return {
    checkEmailExists,
    isChecking,
    emailExists,
    error
  };
};
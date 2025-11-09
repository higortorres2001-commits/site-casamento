import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "use-debounce";

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
    if (!email || !email.includes("@")) {
      setEmailExists(null);
      setError(null);
      return false;
    }

    setIsChecking(true);
    setError(null);

    try {
      console.log("🔍 Checking email existence:", email);
      
      // Chamar edge function para verificar se o email existe
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
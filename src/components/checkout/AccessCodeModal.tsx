"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Mail } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

interface AccessCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onCodeVerified: () => void;
}

const AccessCodeModal = ({ isOpen, onClose, email, onCodeVerified }: AccessCodeModalProps) => {
  const [code, setCode] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleSendCode = async () => {
    setIsSending(true);
    try {
      // Enviar código de acesso usando magic link
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/checkout`,
        },
      });

      if (error) {
        showError("Erro ao enviar código: " + error.message);
      } else {
        showSuccess("Código de acesso enviado para seu e-mail!");
      }
    } catch (error: any) {
      showError("Erro inesperado: " + error.message);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (code.length !== 6) {
      showError("O código deve ter 6 dígitos");
      return;
    }

    setIsVerifying(true);
    try {
      // Verificar o código usando OTP
      const { error } = await supabase.auth.verifyOtp({
        email: email.toLowerCase().trim(),
        token: code,
        type: 'email',
      });

      if (error) {
        showError("Código inválido: " + error.message);
      } else {
        showSuccess("Código verificado com sucesso!");
        onCodeVerified();
        onClose();
      }
    } catch (error: any) {
      showError("Erro ao verificar código: " + error.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-orange-500" />
            Verificar Acesso
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Enviamos um código de 6 dígitos para <strong>{email}</strong>. 
            Digite o código abaixo para acessar sua conta.
          </p>

          <div className="space-y-2">
            <Input
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              maxLength={6}
              className="text-center text-2xl tracking-widest font-mono"
              disabled={isVerifying}
            />
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleSendCode}
                disabled={isSending}
                className="flex-1"
              >
                {isSending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  "Reenviar Código"
                )}
              </Button>
              
              <Button
                onClick={handleVerifyCode}
                disabled={isVerifying || code.length !== 6}
                className="flex-1 bg-orange-500 hover:bg-orange-600"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Verificando...
                  </>
                ) : (
                  "Confirmar Código"
                )}
              </Button>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Não recebeu o código? Verifique sua caixa de entrada e pasta de spam.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccessCodeModal;
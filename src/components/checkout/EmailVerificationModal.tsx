"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

interface EmailVerificationModalProps {
  email: string;
  isOpen: boolean;
  onClose: () => void;
  onVerified: (userData: { name: string; cpf: string; whatsapp: string }) => void;
}

const EmailVerificationModal = ({
  email,
  isOpen,
  onClose,
  onVerified
}: EmailVerificationModalProps) => {
  // Estados do OTP
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30); // 🎯 Alterado para 30 segundos
  const [canResend, setCanResend] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'sending' | 'input' | 'verifying' | 'success'>('sending');
  
  // Referências para os inputs
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // ID de sessão para persistência
  const sessionId = useRef<string>(Math.random().toString(36).substring(2, 15));
  
  // Efeito para enviar o código OTP quando o modal abre
  useEffect(() => {
    if (isOpen && verificationStep === 'sending') {
      sendOtpCode();
    }
  }, [isOpen]);
  
  // Timer para reenvio - 🎯 Corrigido para 30 segundos
  useEffect(() => {
    if (timeLeft > 0 && verificationStep === 'input') {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0) {
      setCanResend(true);
    }
  }, [timeLeft, verificationStep]);
  
  // Persistir estado no localStorage para recuperação após troca de apps
  useEffect(() => {
    // Salvar estado atual
    if (isOpen) {
      localStorage.setItem(`otp_session_${sessionId.current}`, JSON.stringify({
        email,
        step: verificationStep,
        timestamp: Date.now()
      }));
    }
    
    // Verificar se há uma sessão pendente ao montar o componente
    const checkPendingSession = () => {
      try {
        const savedSession = localStorage.getItem(`otp_session_${sessionId.current}`);
        if (savedSession) {
          const session = JSON.parse(savedSession);
          // Se a sessão for recente (menos de 5 minutos)
          if (Date.now() - session.timestamp < 5 * 60 * 1000) {
            console.log("📱 Resuming OTP session", session);
            // Restaurar estado
            if (session.step === 'input' || session.step === 'verifying') {
              setVerificationStep('input');
            }
          }
        }
      } catch (e) {
        console.error("Error checking pending OTP session:", e);
      }
    };
    
    checkPendingSession();
    
    // Adicionar listener para quando o app volta ao foco
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkPendingSession();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', checkPendingSession);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', checkPendingSession);
    };
  }, [isOpen, email]);
  
  // Auto-focus no primeiro input quando estiver no passo de input
  useEffect(() => {
    if (verificationStep === 'input' && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [verificationStep]);

  // Enviar código OTP
  const sendOtpCode = async () => {
    console.log("📧 Sending OTP to:", email);
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.toLowerCase().trim()
      });

      if (error) {
        console.error("Error sending OTP:", error);
        showError("Erro ao enviar código. Tente novamente.");
        setVerificationStep('sending');
      } else {
        console.log("✅ OTP sent successfully");
        showSuccess("Código enviado para seu e-mail!");
        setVerificationStep('input');
        setTimeLeft(30); // 🎯 Reset para 30 segundos
        setCanResend(false);
      }
    } catch (error: any) {
      console.error("Unexpected error sending OTP:", error);
      showError("Erro inesperado. Tente novamente.");
      setVerificationStep('sending');
    } finally {
      setIsResending(false);
    }
  };

  // Verificar código OTP
  const verifyOtpCode = async () => {
    const otpCode = otp.join("");
    
    if (otpCode.length !== 6) {
      showError("Por favor, digite os 6 dígitos do código.");
      return;
    }
    
    setIsVerifying(true);
    setVerificationStep('verifying');

    try {
      console.log("🔐 Verifying OTP code:", otpCode);
      
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email'
      });

      if (error) {
        console.error("OTP verification error:", error);
        showError("Código inválido. Por favor, verifique e tente novamente.");
        
        // Limpa todos os campos
        setOtp(Array(6).fill(""));
        setVerificationStep('input');
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      } else if (data.user) {
        console.log("✅ OTP verified successfully");
        showSuccess("Código verificado com sucesso!");
        setVerificationStep('success');
        
        // Buscar dados do usuário no perfil
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, cpf, whatsapp")
          .eq("id", data.user.id)
          .single();

        if (profileError || !profile) {
          console.error("Error fetching user profile:", profileError);
          showError("Erro ao carregar seus dados. Por favor, tente novamente.");
        } else {
          // Limpar a sessão do localStorage
          localStorage.removeItem(`otp_session_${sessionId.current}`);
          
          // Notificar o componente pai
          setTimeout(() => {
            onVerified({
              name: profile.name || "",
              cpf: profile.cpf || "",
              whatsapp: profile.whatsapp || ""
            });
          }, 1000);
        }
      }
    } catch (error: any) {
      console.error("Unexpected error during OTP verification:", error);
      showError("Erro inesperado. Por favor, tente novamente.");
      setVerificationStep('input');
    } finally {
      setIsVerifying(false);
    }
  };

  // Manipular mudança nos inputs de OTP
  const handleOtpChange = (index: number, value: string) => {
    // Permitir apenas números
    const numericValue = value.replace(/\D/g, "").slice(0, 1);
    
    const newOtp = [...otp];
    newOtp[index] = numericValue;
    setOtp(newOtp);

    // Auto-focus no próximo input
    if (numericValue && index < 5 && inputRefs.current[index + 1]) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit quando todos os 6 dígitos forem preenchidos
    if (newOtp.every(digit => digit !== "")) {
      setTimeout(() => verifyOtpCode(), 300);
    }
  };

  // Manipular tecla pressionada nos inputs de OTP
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Manipular colagem de texto nos inputs de OTP
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    
    if (pastedData.length === 6) {
      const newOtp = pastedData.split("");
      setOtp(newOtp);
      
      // Focus no último input
      if (inputRefs.current[5]) {
        inputRefs.current[5]?.focus();
      }
      
      // Auto-submit
      setTimeout(() => verifyOtpCode(), 300);
    }
  };

  // 🎯 Função para reenviar código
  const handleResendCode = async () => {
    console.log("🔄 Resending OTP code");
    setCanResend(false);
    setTimeLeft(30); // Reset timer para 30 segundos
    setOtp(Array(6).fill("")); // Limpar campos
    await sendOtpCode();
  };

  // Renderizar conteúdo baseado no passo atual
  const renderContent = () => {
    switch (verificationStep) {
      case 'sending':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Enviando código...</h3>
            <p className="text-gray-600 text-center">
              Estamos enviando um código de verificação para seu e-mail.
            </p>
          </div>
        );
        
      case 'input':
        return (
          <>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2 text-center">
              Verifique seu E-mail
            </h3>
            <p className="text-gray-600 text-center mb-6">
              Enviamos um código de 6 dígitos para:<br />
              <span className="font-semibold text-blue-600">{email}</span>
            </p>
            
            <div className="text-center mb-6">
              <p className="text-sm text-gray-600 mb-4">
                Digite o código abaixo:
              </p>
              
              <div className="flex justify-center gap-2">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                    onPaste={handlePaste}
                    className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500"
                    disabled={isVerifying}
                  />
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <Button
                onClick={verifyOtpCode}
                disabled={isVerifying || otp.join("").length !== 6}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  "Verificar Código"
                )}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600">
                  Não recebeu o código?
                </p>
                <Button
                  variant="ghost"
                  onClick={handleResendCode}
                  disabled={!canResend || isResending}
                  className="text-blue-600 hover:text-blue-700"
                >
                  {isResending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : canResend ? (
                    "Reenviar Código"
                  ) : (
                    `Reenviar em ${timeLeft}s`
                  )}
                </Button>
              </div>

              <Button
                variant="outline"
                onClick={onClose}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
            </div>
          </>
        );
        
      case 'verifying':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Verificando...</h3>
            <p className="text-gray-600 text-center">
              Estamos verificando seu código. Por favor, aguarde.
            </p>
          </div>
        );
        
      case 'success':
        return (
          <div className="flex flex-col items-center justify-center py-8">
            <CheckCircle className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Verificado com Sucesso!</h3>
            <p className="text-gray-600 text-center">
              Seu e-mail foi verificado com sucesso. Você será redirecionado em instantes.
            </p>
          </div>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      // Impedir que o modal seja fechado durante verificação
      if (!open && verificationStep !== 'verifying' && verificationStep !== 'success') {
        onClose();
      }
    }}>
      <DialogContent className="sm:max-w-md p-6">
        {renderContent()}
      </DialogContent>
    </Dialog>
  );
};

export default EmailVerificationModal;
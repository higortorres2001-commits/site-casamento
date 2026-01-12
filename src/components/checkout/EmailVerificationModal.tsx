"use client";

import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { GUEST_MESSAGES, AUTH_MESSAGES } from "@/constants/messages";

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
  // OTP expiration time (5 minutes)
  const OTP_EXPIRY_SECONDS = 300;
  const RESEND_COOLDOWN_SECONDS = 60;

  // Estados do OTP
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [canResend, setCanResend] = useState(false);
  const [verificationStep, setVerificationStep] = useState<'sending' | 'input' | 'verifying' | 'success'>('sending');
  const [otpExpiresIn, setOtpExpiresIn] = useState(OTP_EXPIRY_SECONDS);
  const [isOtpExpired, setIsOtpExpired] = useState(false);

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

  // Timer para reenvio (cooldown)
  useEffect(() => {
    if (resendCooldown > 0 && verificationStep === 'input') {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (resendCooldown === 0) {
      setCanResend(true);
    }
  }, [resendCooldown, verificationStep]);

  // Timer para expiração do OTP
  useEffect(() => {
    if (otpExpiresIn > 0 && verificationStep === 'input' && !isOtpExpired) {
      const timer = setTimeout(() => setOtpExpiresIn(otpExpiresIn - 1), 1000);
      return () => clearTimeout(timer);
    } else if (otpExpiresIn === 0 && !isOtpExpired) {
      setIsOtpExpired(true);
      showError("Código expirado. Por favor, solicite um novo.");
    }
  }, [otpExpiresIn, verificationStep, isOtpExpired]);

  // Auto-focus no primeiro input quando estiver no passo de input
  useEffect(() => {
    if (verificationStep === 'input' && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [verificationStep]);

  // Enviar código OTP usando a função específica
  const sendOtpCode = async () => {
    console.log("📧 Sending OTP to:", email);
    setIsResending(true);

    try {
      const { data, error } = await supabase.functions.invoke("send-checkout-otp", {
        body: { email: email.toLowerCase().trim() }
      });

      if (error) {
        console.error("Error sending OTP:", error);
        showUserError(GUEST_MESSAGES.error.GENERIC, error);
        setVerificationStep('sending');
      } else if (data?.error) {
        console.error("Function returned error:", data.error);
        showError(data.error);
        setVerificationStep('sending');
      } else {
        console.log("✅ OTP sent successfully");
        showSuccess("Código enviado para seu e-mail!");
        setVerificationStep('input');
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setCanResend(false);
        setOtpExpiresIn(OTP_EXPIRY_SECONDS);
        setIsOtpExpired(false);
      }
    } catch (error: any) {
      console.error("Unexpected error sending OTP:", error);
      showUserError(GUEST_MESSAGES.error.GENERIC, error);
      setVerificationStep('sending');
    } finally {
      setIsResending(false);
    }
  };

  // Verificar código OTP usando a função específica
  const verifyOtpCode = async () => {
    const otpCode = otp.join("");

    if (otpCode.length !== 6) {
      showError("Por favor, digite os 6 dígitos do código.");
      return;
    }

    if (isOtpExpired) {
      showError("Código expirado. Por favor, solicite um novo.");
      return;
    }

    setIsVerifying(true);
    setVerificationStep('verifying');

    try {
      console.log("🔐 Verifying OTP code:", otpCode);

      const { data, error } = await supabase.functions.invoke("verify-checkout-otp", {
        body: {
          email: email.toLowerCase().trim(),
          token: otpCode
        }
      });

      if (error) {
        console.error("OTP verification error:", error);
        showUserError(GUEST_MESSAGES.error.GENERIC, error);
        setOtp(Array(6).fill(""));
        setVerificationStep('input');
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      } else if (data?.error) {
        console.error("Function returned error:", data.error);
        showError(data.error);
        setOtp(Array(6).fill(""));
        setVerificationStep('input');
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      } else if (data?.success && data?.userData) {
        console.log("✅ OTP verified successfully");
        showSuccess("Código verificado com sucesso!");
        setVerificationStep('success');

        // Limpar a sessão do localStorage
        localStorage.removeItem(`otp_session_${sessionId.current}`);

        // Notificar o componente pai
        setTimeout(() => {
          onVerified(data.userData);
        }, 1000);
      } else {
        showError(GUEST_MESSAGES.error.GENERIC);
        setVerificationStep('input');
      }
    } catch (error: any) {
      console.error("Unexpected error during OTP verification:", error);
      showUserError(GUEST_MESSAGES.error.GENERIC, error);
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

  // Função para reenviar código
  const handleResendCode = async () => {
    console.log("🔄 Resending OTP code");
    setCanResend(false);
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
    setOtp(Array(6).fill(""));
    setIsOtpExpired(false);
    await sendOtpCode();
  };

  // Formatar tempo restante
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

              {/* OTP Expiration Warning */}
              {otpExpiresIn > 0 && otpExpiresIn <= 60 && (
                <p className="text-xs text-orange-600 font-medium">
                  ⚠️ Código expira em {formatTime(otpExpiresIn)}
                </p>
              )}
              {otpExpiresIn > 60 && (
                <p className="text-xs text-gray-400">
                  Código válido por {formatTime(otpExpiresIn)}
                </p>
              )}
              {isOtpExpired && (
                <p className="text-xs text-red-600 font-medium">
                  ❌ Código expirado. Solicite um novo abaixo.
                </p>
              )}
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
                    `Aguarde ${resendCooldown}s para reenviar`
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
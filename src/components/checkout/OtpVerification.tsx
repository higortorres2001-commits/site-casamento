"use client";

import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

interface OtpVerificationProps {
  email: string;
  onVerified: () => void;
  onBack: () => void;
  onUserDataLoaded: (userData: { name: string; cpf: string; whatsapp: string }) => void;
}

const OtpVerification = ({ email, onVerified, onBack, onUserDataLoaded }: OtpVerificationProps) => {
  const [otp, setOtp] = useState(["", "", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(35);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer para reenvio
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [timeLeft]);

  // Auto-focus no primeiro input
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, []);

  const handleInputChange = (index: number, value: string) => {
    // Apenas permite números
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
      setTimeout(() => handleVerifyOtp(newOtp.join("")), 100);
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0 && inputRefs.current[index - 1]) {
      inputRefs.current[index - 1]?.focus();
    }
  };

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
      setTimeout(() => handleVerifyOtp(pastedData), 100);
    }
  };

  const handleVerifyOtp = async (otpCode?: string) => {
    const codeToVerify = otpCode || otp.join("");
    
    if (codeToVerify.length !== 6) {
      showError("Por favor, digite os 6 dígitos do código.");
      return;
    }

    setIsVerifying(true);

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: codeToVerify,
        type: 'email'
      });

      if (error) {
        console.error("OTP verification error:", error);
        showError("Código inválido. Por favor, verifique e tente novamente.");
        
        // Limpa todos os campos
        setOtp(["", "", "", "", "", "", ""]);
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      } else if (data.user) {
        showSuccess("Código verificado com sucesso!");
        
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
          // Passa os dados do usuário para o componente pai
          onUserDataLoaded({
            name: profile.name || "",
            cpf: profile.cpf || "",
            whatsapp: profile.whatsapp || ""
          });
          
          // Informa que o usuário foi verificado
          onVerified();
        }
      }
    } catch (error: any) {
      console.error("Unexpected error during OTP verification:", error);
      showError("Erro inesperado. Por favor, tente novamente.");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setIsResending(true);
    
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email
      });

      if (error) {
        console.error("Error resending OTP:", error);
        showError("Erro ao reenviar o código. Por favor, tente novamente.");
      } else {
        showSuccess("Código reenviado com sucesso!");
        
        // Reset timer
        setTimeLeft(35);
        setCanResend(false);
        
        // Limpa campos e focus no primeiro
        setOtp(["", "", "", "", "", "", ""]);
        if (inputRefs.current[0]) {
          inputRefs.current[0]?.focus();
        }
      }
    } catch (error: any) {
      console.error("Unexpected error resending OTP:", error);
      showError("Erro inesperado. Por favor, tente novamente.");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-blue-600" />
        </div>
        <CardTitle className="text-2xl font-bold text-gray-800">
          Verifique seu E-mail
        </CardTitle>
        <p className="text-gray-600 mt-2">
          Enviamos um código de 6 dígitos para:<br />
          <span className="font-semibold text-blue-600">{email}</span>
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="text-center">
          <p className="text-sm text-gray-600 mb-4">
            Digite o código abaixo:
          </p>
          
          <div className="flex justify-center gap-2">
            {otp.map((digit, index) => (
              <Input
                key={index}
                ref={(el) => (inputRefs.current[index] = el)}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleInputChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                onPaste={handlePaste}
                className="w-12 h-12 text-center text-xl font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-blue-500"
                disabled={isVerifying}
              />
            ))}
          </div>
        </div>

        <div className="text-center space-y-4">
          <Button
            onClick={() => handleVerifyOtp()}
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
              onClick={handleResendOtp}
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
            onClick={onBack}
            className="w-full"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OtpVerification;
"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

// Função para gerar uma senha forte e aleatória
function generateStrongPassword(): string {
  const length = 12;
  const uppercaseChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercaseChars = 'abcdefghijklmnopqrstuvwxyz';
  const numberChars = '0123456789';
  const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?';

  const getRandomChar = (chars: string) => 
    chars[Math.floor(Math.random() * chars.length)];

  // Garantir pelo menos um caractere de cada tipo
  const password = [
    getRandomChar(uppercaseChars),
    getRandomChar(lowercaseChars),
    getRandomChar(numberChars),
    getRandomChar(specialChars),
    ...Array.from({ length: length - 4 }, () => 
      getRandomChar(uppercaseChars + lowercaseChars + numberChars + specialChars)
    )
  ];

  // Embaralhar a senha
  return password
    .sort(() => Math.random() - 0.5)
    .join('');
}

interface CustomerEditorModalProps {
  open: boolean;
  onClose: () => void;
  customer: any; // Profile with id, name, email, access
  products: { id: string; name: string }[];
  onRefresh: () => void;
}

const CustomerEditorModal = ({
  open,
  onClose,
  customer,
  products,
  onRefresh,
}: CustomerEditorModalProps) => {
  const [name, setName] = useState<string>(customer?.name ?? "");
  const [email, setEmail] = useState<string>(customer?.email ?? "");
  const [selected, setSelected] = useState<string[]>(customer?.access ?? []);
  const [isAdmin, setIsAdmin] = useState<boolean>(customer?.is_admin ?? false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setSelected(customer.access ?? []);
      setIsAdmin(customer.is_admin ?? false);
    }
  }, [customer, open]);

  const toggleProduct = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleResetPassword = async () => {
    if (!customer?.id) return;

    if (!window.confirm("Tem certeza que deseja redefinir a senha para este usuário? Ele será obrigado a trocar a senha no próximo login.")) return;

    setIsLoading(true);
    try {
      // Gerar uma senha forte e aleatória
      const newPassword = generateStrongPassword();

      // Atualizar a senha do usuário
      const { error: updatePasswordError } = await supabase.auth.updateUser({
        password: newPassword,
      }, { 
        // Especificar o ID do usuário para garantir que estamos atualizando o usuário correto
        userId: customer.id 
      });

      if (updatePasswordError) {
        showError("Erro ao redefinir senha: " + updatePasswordError.message);
        console.error("Password reset error:", updatePasswordError);
        return;
      }

      // Atualizar o perfil para forçar troca de senha
      const { error: profileUpdateError } = await supabase
        .from('profiles')
        .update({ 
          has_changed_password: false, 
          primeiro_acesso: true 
        })
        .eq('id', customer.id);

      if (profileUpdateError) {
        showError("Erro ao atualizar perfil: " + profileUpdateError.message);
        console.error("Profile update error:", profileUpdateError);
        return;
      }

      // Log da redefinição de senha
      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-reset-password',
        message: 'Admin reset user password',
        metadata: { 
          adminId: customer.id, 
          userId: customer.id 
        }
      });

      // Enviar email com instruções de redefinição de senha
      const RESEND_API_KEY = import.meta.env.VITE_RESEND_API_KEY;
      const APP_URL = import.meta.env.VITE_APP_URL || 'https://seusite.com';
      
      if (RESEND_API_KEY && customer.email) {
        const loginUrl = `${APP_URL}/login`;
        
        const emailBody = `
          Sua senha foi redefinida por um administrador. 
          
          Para acessar sua conta:
          Login: ${loginUrl}
          Email: ${customer.email}

          Por segurança, você será solicitado a definir uma nova senha no primeiro login.
        `;

        const resendResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'onboarding@resend.dev',
            to: customer.email,
            subject: 'Sua senha foi redefinida',
            html: emailBody.replace(/\n/g, '<br/>'),
          }),
        });

        if (!resendResponse.ok) {
          const errorData = await resendResponse.json();
          await supabase.from('logs').insert({
            level: 'error',
            context: 'admin-reset-password',
            message: 'Error sending password reset email',
            metadata: { 
              userId: customer.id, 
              email: customer.email, 
              resendError: errorData 
            }
          });
        }
      }

      showSuccess("Senha redefinida com sucesso! O usuário deverá trocar a senha no próximo login.");
      onRefresh();
    } catch (error: any) {
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Resto do código permanece igual...

  return (
    // Código do componente permanece igual
  );
};

export default CustomerEditorModal;
"use client";

import { useEffect } from 'react';
import { useSession } from '@/components/SessionContextProvider';
import { initializePixelWithUserData } from '@/utils/metaPixel';

// Função para extrair primeiro e último nome
const extractNameParts = (fullName: string | null | undefined): { firstName: string | null; lastName: string | null } => {
  if (!fullName || typeof fullName !== 'string') {
    return { firstName: null, lastName: null };
  }
  
  const nameParts = fullName.trim().split(/\s+/);
  if (nameParts.length === 0) {
    return { firstName: null, lastName: null };
  }
  
  const firstName = nameParts[0];
  const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
  
  return { firstName, lastName };
};

// Função para limpar WhatsApp (remover formatação)
const cleanWhatsApp = (whatsapp: string | null | undefined): string | null => {
  if (!whatsapp) return null;
  return whatsapp.replace(/\D/g, ''); // Remove tudo que não é dígito
};

export const usePixelInitialization = () => {
  const { user } = useSession();

  useEffect(() => {
    // Aguardar um pouco para garantir que o fbq esteja disponível
    const timer = setTimeout(() => {
      if (typeof window !== 'undefined' && window.fbq) {
        if (user) {
          // Usuário logado - inicializar com dados avançados
          const customerData = {
            email: user.email || null,
            phone: user.user_metadata?.whatsapp ? cleanWhatsApp(user.user_metadata.whatsapp) : null,
            firstName: user.user_metadata?.name ? extractNameParts(user.user_metadata.name).firstName : null,
            lastName: user.user_metadata?.name ? extractNameParts(user.user_metadata.name).lastName : null,
          };

          initializePixelWithUserData('1335524184734471', customerData);
        } else {
          // Usuário não logado - inicialização padrão
          initializePixelWithUserData('1335524184734471');
        }
      }
    }, 1000); // Aguardar 1 segundo para garantir que o Pixel esteja carregado

    return () => clearTimeout(timer);
  }, [user]);
};
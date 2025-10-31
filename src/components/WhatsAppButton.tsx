"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { BrandWhatsapp } from 'lucide-react'; // Usando ícone do Lucide para WhatsApp

const WHATSAPP_URL = "https://web.whatsapp.com/send?phone=5537991202425&text=";

const WhatsAppButton = () => {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-24 right-4 z-50"
    >
      <Button
        className="rounded-full w-14 h-14 bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center"
        size="icon"
      >
        <BrandWhatsapp className="h-7 w-7" />
      </Button>
    </a>
  );
};

export default WhatsAppButton;
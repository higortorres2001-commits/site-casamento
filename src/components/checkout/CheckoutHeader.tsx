"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const CheckoutHeader = () => {
  // Removida a lógica de fetchShopUrl e o estado shopUrl, pois o link será removido.

  return (
    <header className="bg-white shadow-sm py-4 px-4 md:px-8 sticky top-0 z-40 w-full h-16 flex items-center justify-between">
      <div className="flex items-center">
        {/* O botão "Voltar para a loja" foi removido */}
      </div>
      <Link to="/" className="text-2xl font-bold text-gray-800">
        Seu Logo
      </Link>
      <div className="w-1/3 flex justify-end">
        {/* Placeholder para alinhamento */}
      </div>
    </header>
  );
};

export default CheckoutHeader;
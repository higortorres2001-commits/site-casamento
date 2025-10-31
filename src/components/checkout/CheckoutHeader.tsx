"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const CheckoutHeader = () => {
  // Substituir o placeholder por logo SemEstress
  return (
    <header className="bg-white shadow-sm py-4 px-4 md:px-8 sticky top-0 z-40 w-full h-16 flex items-center justify-between">
      <div className="flex items-center">
        <Link to="/" className="mr-2 hidden sm:block">
          <img src="/medsemestress.webp" alt="SemEstress Logo" style={{ height: 40 }} />
        </Link>
        <span className="ml-1 text-xl font-bold text-gray-800">SemEstress</span>
      </div>
      <Link to="/" className="text-2xl font-bold text-gray-800 hidden md:block">
        {/* Espaço reservado para branding adicional, se necessário */}
      </Link>
      <div className="w-1/3 flex justify-end">
        {/* Placeholder para alinhamento */}
      </div>
    </header>
  );
};

export default CheckoutHeader;
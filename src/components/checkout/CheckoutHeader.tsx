"use client";

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { showError } from '@/utils/toast';

const CheckoutHeader = () => {
  const [shopUrl, setShopUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchShopUrl = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'shop_url')
        .single();

      if (error) {
        console.error("Error fetching shop_url:", error.message);
        showError("Erro ao carregar o link da loja.");
      } else if (data) {
        setShopUrl(data.value);
      }
    };
    fetchShopUrl();
  }, []);

  return (
    <header className="bg-white shadow-sm py-4 px-4 md:px-8 sticky top-0 z-40 w-full h-16 flex items-center justify-between">
      <div className="flex items-center">
        {shopUrl && (
          <a href={shopUrl} target="_self" rel="noopener noreferrer">
            <Button variant="ghost" className="text-gray-600 hover:text-gray-800">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para a loja
            </Button>
          </a>
        )}
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
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Product } from "@/types";
import { showError } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";

const MyProducts = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMyProducts = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch user profile to get the 'access' array
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('access')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          showError("Erro ao carregar seu perfil.");
          console.error("Error fetching profile:", profileError);
          setMyProducts([]);
          setIsLoading(false);
          return;
        }

        const productIds = profile.access || [];

        if (productIds.length === 0) {
          setMyProducts([]);
          setIsLoading(false);
          return;
        }

        // 2. Fetch product details for the IDs in the 'access' array
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*')
          .in('id', productIds);

        if (productsError) {
          showError("Erro ao carregar seus produtos.");
          console.error("Error fetching products:", productsError);
          setMyProducts([]);
        } else {
          setMyProducts(productsData || []);
        }
      } catch (error: any) {
        showError("Erro inesperado ao carregar produtos: " + error.message);
        console.error("Unexpected error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!isSessionLoading) {
      fetchMyProducts();
    }
  }, [user, isSessionLoading]);

  if (isLoading || isSessionLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 bg-gray-100 min-h-screen">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">Minha Biblioteca</h1>

      {myProducts.length === 0 ? (
        <div className="text-center text-gray-600 text-lg mt-10">
          <p>Você ainda não possui nenhum produto em sua biblioteca.</p>
          <p>Explore nossos produtos para começar!</p>
          {/* Optionally add a link to a products marketplace page */}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {myProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MyProducts;
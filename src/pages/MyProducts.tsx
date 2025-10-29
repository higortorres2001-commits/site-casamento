"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Product } from "@/types";
import { showError } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { useNavigate } from "react-router-dom"; // Import useNavigate

const MyProducts = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate(); // Initialize useNavigate

  useEffect(() => {
    const fetchMyProducts = async () => {
      if (!user) {
        setIsLoading(false);
        // SessionContextProvider already handles redirection to /login if not logged in
        return;
      }

      setIsLoading(true);
      try {
        // 1. Fetch user profile to get 'access' array and 'has_changed_password'
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('access, has_changed_password')
          .eq('id', user.id)
          .single();

        if (profileError || !profile) {
          showError("Erro ao carregar seu perfil.");
          console.error("Error fetching profile:", profileError);
          setMyProducts([]);
          setIsLoading(false);
          return;
        }

        // CRITICAL: Check if user has changed password
        if (profile.has_changed_password === false) {
          console.log("User has not changed password, redirecting to /update-password"); // CORRIGIDO
          navigate("/update-password"); // CORRIGIDO: Redirecionar para /update-password
          setIsLoading(false); // Stop loading state as we are redirecting
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
  }, [user, isSessionLoading, navigate]); // Add navigate to dependencies

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
          {/* O link "Visite nossa loja" foi removido */}
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
"use client";

import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { Product } from "@/types";
import { showError } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import ProductsAlsoBuy from "@/components/ProductsAlsoBuy";
import { useNavigate } from "react-router-dom";

const MyProducts = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [alsoBuyProducts, setAlsoBuyProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchMyProducts = async () => {
      if (!user) {
        setIsLoading(false);
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
          setAlsoBuyProducts([]);
          setIsLoading(false);
          return;
        }

        // CRITICAL: Check if user has changed password
        if (profile.has_changed_password === false) {
          console.log("User has not changed password, redirecting to /primeira-senha");
          navigate("/primeira-senha");
          setIsLoading(false);
          return;
        }

        const productIds = profile.access || [];

        if (productIds.length === 0) {
          setMyProducts([]);
          // Fetch all ACTIVE products with also_buy=true for "Compre Também" section
          const { data: allProducts, error: allProductsError } = await supabase
            .from('products')
            .select('*')
            .eq('status', 'ativo') // Only fetch ACTIVE products
            .eq('also_buy', true) // Only fetch products with also_buy=true
            .order('created_at', { ascending: false });

          if (allProductsError) {
            console.error("Error fetching all products:", allProductsError);
            setAlsoBuyProducts([]);
          } else {
            setAlsoBuyProducts(allProducts || []);
          }
          setIsLoading(false);
          return;
        }

        // 2. Fetch user's products
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

        // 3. Fetch all ACTIVE products with also_buy=true that user doesn't have for "Compre Também" section
        const { data: allProducts, error: allProductsError } = await supabase
          .from('products')
          .select('*')
          .eq('status', 'ativo') // Only fetch ACTIVE products
          .eq('also_buy', true) // Only fetch products with also_buy=true
          .not('id', 'in', `(${productIds.join(',')})`)
          .order('created_at', { ascending: false })
          .limit(6); // Limit to 6 products for "Compre Também"

        if (allProductsError) {
          console.error("Error fetching all products:", allProductsError);
          setAlsoBuyProducts([]);
        } else {
          setAlsoBuyProducts(allProducts || []);
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
  }, [user, isSessionLoading, navigate]);

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
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {myProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* "Compre Também" Section - Only show if there are products to display */}
      {alsoBuyProducts.length > 0 && (
        <ProductsAlsoBuy products={alsoBuyProducts} />
      )}
    </div>
  );
};

export default MyProducts;
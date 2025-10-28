"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { useSession } from "@/components/SessionContextProvider";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const Index = () => {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Bem-vindo ao seu aplicativo!</h1>
        <p className="text-xl text-gray-600 mb-6">
          {user ? `Olá, ${user.email}! Você está logado.` : "Faça login para começar."}
        </p>
        {user && (
          <Link to="/admin/products">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              Gerenciar Produtos
            </Button>
          </Link>
        )}
      </div>
      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Index;
"use client";

import { MadeWithSemEstress } from "@/components/made-with-semestress";
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
        <h1 className="text-4xl font-bold mb-4">Bem-vindo ao SemEstress</h1>
        <p className="text-xl text-gray-600 mb-6">
          {user ? `Olá, ${user.email}! Você está logado.` : "Faça login para começar."}
        </p>
        {user && (
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/meus-produtos">
              <Button className="bg-blue-500 hover:bg-blue-600 text-white">
                Meus Produtos
              </Button>
            </Link>
            <Link to="/admin/products">
              <Button className="bg-gray-800 hover:bg-black text-white">
                Gerenciar Produtos
              </Button>
            </Link>
          </div>
        )}
      </div>
      <MadeWithSemEstress />
    </div>
  );
};

export default Index;
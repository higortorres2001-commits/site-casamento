"use client";

import React, { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { showError } from "@/utils/toast";

const ProcessingPayment = () => {
  const navigate = useNavigate();
  const { user, isLoading: isSessionLoading } = useSession();

  useEffect(() => {
    if (!isSessionLoading && user) {
      const userId = user.id;

      // Set up the Realtime Listener
      const channel = supabase
        .channel(`profile_updates:${userId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profiles",
            filter: `id=eq.${userId}`,
          },
          (payload) => {
            console.log("Profile update received:", payload);
            const newAccess = (payload.new as any).access;

            if (newAccess && newAccess.length > 0) {
              showError("Seu acesso aos produtos foi liberado!"); // Using showError for a prominent message
              channel.unsubscribe(); // Stop listening
              navigate("/meus-produtos"); // Redirect to My Products
            }
          }
        )
        .subscribe();

      // Cleanup function to unsubscribe when the component unmounts
      return () => {
        channel.unsubscribe();
      };
    }
  }, [isSessionLoading, user, navigate]);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 flex items-center justify-center">
      <Card className="bg-white rounded-xl shadow-lg max-w-md mx-auto p-6 text-center">
        <CardHeader className="pb-4">
          <Loader2 className="h-16 w-16 animate-spin text-orange-500 mx-auto mb-4" />
          <CardTitle className="text-3xl font-bold text-gray-800">
            Aguardando Confirmação de Pagamento...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-lg text-gray-700">
            Assim que o pagamento for confirmado, seu acesso será liberado automaticamente.
          </p>
          <p className="text-sm text-gray-500">
            Isso pode levar alguns minutos. Por favor, não feche esta página.
          </p>
          <Link to="/login">
            <Button variant="outline" className="w-full mt-4">
              Ainda não liberou? Ir para a tela de Login
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProcessingPayment;
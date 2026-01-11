"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Brand from '@/components/Brand';
import LoginForm from '@/components/LoginForm';

const Login = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header with Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Brand size="xl" />
          </div>
          <p className="text-gray-500 mt-2 text-sm">
            Sua lista de presentes de casamento
          </p>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <h2 className="text-xl font-semibold text-gray-800">
              Bem-vindo de volta! 💒
            </h2>
            <p className="text-sm text-gray-500">
              Entre na sua conta para gerenciar sua lista
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <LoginForm />
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-6">
          © 2025 DuetLove. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default Login;
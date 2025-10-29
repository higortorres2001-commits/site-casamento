"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import LoginForm from '@/components/LoginForm'; // Import the new custom login form
import React from 'react'; // Import React

const Login = () => {
  console.log("Login component rendered"); // Adicionado para depuração
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {/* O título e a descrição agora são gerenciados pelo LoginForm */}
        </CardHeader>
        <CardContent>
          <LoginForm /> {/* Use o novo formulário de login personalizado aqui */}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Login;
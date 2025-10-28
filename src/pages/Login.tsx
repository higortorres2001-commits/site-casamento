"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MadeWithDyad } from '@/components/made-with-dyad';
import LoginForm from '@/components/LoginForm'; // Import the new custom login form

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Bem-vindo de volta!</CardTitle>
          <CardDescription>Faça login para acessar sua conta.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm /> {/* Use the new custom login form here */}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Login;
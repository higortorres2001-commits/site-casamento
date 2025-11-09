"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Brand from '@/components/Brand';
import { MadeWithDyad } from '@/components/made-with-dyad';
import LoginForm from '@/components/LoginForm'; // Import o formulário de login

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Brand /> {/* Brand no lugar do texto "Seu Logo" */}
        </CardHeader>
        <CardContent>
          <LoginForm /> {/* Use o formulário de login existente */}
        </CardContent>
      </Card>
      <MadeWithDyad />
    </div>
  );
};

export default Login;
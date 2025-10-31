"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { MadeWithSemEstress } from '@/components/made-with-semestress';
import LoginForm from '@/components/LoginForm'; // Import the new custom login form

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src="/medsemestress.webp" alt="SemEstress" style={{ height: 72 }} />
        </CardHeader>
        <CardContent>
          <LoginForm /> {/* Use o novo formulário de login personalizado aqui */}
        </CardContent>
      </Card>
      <MadeWithSemEstress />
    </div>
  );
};

export default Login;
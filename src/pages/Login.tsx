"use client";

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import Brand from '@/components/Brand';
import { MadeWithDyad } from '@/components/made-with-dyad';
import LoginForm from '@/components/LoginForm';
import { Link } from 'react-router-dom';

const Login = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Brand />
        </CardHeader>
        <CardContent>
          <LoginForm />
          <div className="text-center mt-4">
            <p className="text-sm text-gray-600">
              Não tem uma conta?{" "}
              <Link
                to="/register"
                className="text-orange-600 hover:text-orange-700 font-medium"
              >
                Crie agora
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
      <div className="mt-auto">
        <MadeWithDyad />
      </div>
    </div>
  );
};

export default Login;
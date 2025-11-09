"use client";

import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, User, Mail, Phone, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { isValidCPF, formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp, isValidWhatsapp } from "@/utils/whatsappValidation";
import Brand from "@/components/Brand";

const formSchema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  cpf: z.string()
    .transform(val => val.replace(/[^\d]+/g, ''))
    .refine(val => val.length === 11 && isValidCPF(val), {
      message: "CPF inválido",
    }),
  whatsapp: z.string()
    .transform(val => val.replace(/\D/g, ''))
    .refine(val => isValidWhatsapp(val), {
      message: "WhatsApp inválido",
    }),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem.",
  path: ["confirmPassword"],
});

type FormData = z.infer<typeof formSchema>;

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      cpf: "",
      whatsapp: "",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);

    try {
      // Verificar se o email já existe
      const { data: existingUsers } = await supabase.auth.admin.listUsers({
        email: data.email,
      });

      if (existingUsers.users && existingUsers.users.length > 0) {
        showError("Este email já está em uso. Por favor, faça login.");
        setIsLoading(false);
        return;
      }

      // Verificar se o CPF já existe nos perfis
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("cpf", data.cpf)
        .single();

      if (existingProfile) {
        showError("Este CPF já está cadastrado. Por favor, faça login.");
        setIsLoading(false);
        return;
      }

      // Criar usuário no auth
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: data.email.toLowerCase().trim(),
        password: data.password,
        email_confirm: true,
        user_metadata: {
          name: data.name,
          cpf: data.cpf,
          whatsapp: data.whatsapp,
          created_via: "register_page",
        },
      });

      if (createError || !newUser?.user) {
        showError("Erro ao criar conta: " + createError?.message);
        console.error("Create user error:", createError);
        return;
      }

      // Criar perfil
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: newUser.user.id,
          name: data.name,
          cpf: data.cpf,
          email: data.email.toLowerCase().trim(),
          whatsapp: data.whatsapp,
          access: [],
          primeiro_acesso: true,
          has_changed_password: false,
          is_admin: false,
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Não falhar completamente - o usuário foi criado no auth
      }

      // Log do sucesso
      await supabase.from('logs').insert({
        level: 'info',
        context: 'user-registration',
        message: 'User registered successfully',
        metadata: {
          userId: newUser.user.id,
          email: data.email.toLowerCase().trim(),
          name: data.name,
          createdVia: 'register_page'
        }
      });

      showSuccess("Conta criada com sucesso! Você será redirecionado para o login.");
      setIsSuccess(true);

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        navigate("/login");
      }, 2000);

    } catch (error: any) {
      console.error("Registration error:", error);
      showError("Erro inesperado: " + error.message);
      
      await supabase.from('logs').insert({
        level: 'error',
        context: 'user-registration',
        message: 'Unexpected error during registration',
        metadata: {
          errorMessage: error.message,
          errorStack: error.stack,
          email: data.email.toLowerCase().trim()
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center p-6">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Conta Criada com Sucesso!
            </h2>
            <p className="text-gray-600 mb-4">
              Redirecionando para a página de login...
            </p>
            <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Brand />
          <CardTitle className="text-2xl font-bold text-gray-800 mt-4">
            Criar Conta
          </CardTitle>
          <p className="text-gray-600">
            Preencha os dados abaixo para criar sua conta
          </p>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Seu nome completo"
                        {...field}
                        disabled={isLoading}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="seu@email.com"
                        {...field}
                        disabled={isLoading}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        disabled={isLoading}
                        maxLength={14}
                        onChange={(e) => {
                          const formatted = formatCPF(e.target.value);
                          field.onChange(formatted);
                        }}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="whatsapp"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WhatsApp</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        {...field}
                        disabled={isLoading}
                        maxLength={15}
                        onChange={(e) => {
                          const formatted = formatWhatsapp(e.target.value);
                          field.onChange(formatted);
                        }}
                        className="focus:ring-orange-500 focus:border-orange-500"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Mínimo 6 caracteres"
                          {...field}
                          disabled={isLoading}
                          className="focus:ring-orange-500 focus:border-orange-500 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => setShowPassword(!showPassword)}
                          disabled={isLoading}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirmar Senha</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Confirme sua senha"
                          {...field}
                          disabled={isLoading}
                          className="focus:ring-orange-500 focus:border-orange-500 pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-1 top-1/2 -translate-y-1/2"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          disabled={isLoading}
                        >
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando Conta...
                  </>
                ) : (
                  "Criar Conta"
                )}
              </Button>

              <div className="text-center mt-4">
                <p className="text-sm text-gray-600">
                  Já tem uma conta?{" "}
                  <Link
                    to="/login"
                    className="text-orange-600 hover:text-orange-700 font-medium"
                  >
                    Faça Login
                  </Link>
                </p>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
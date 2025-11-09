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
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Link, useNavigate } from "react-router-dom";

// Define the form schema type explicitly
const formSchema = z.object({
  email: z.string().email("Email inválido").min(1, "O email é obrigatório"),
  password: z.string().min(1, "A senha é obrigatória"),
});

type FormData = z.infer<typeof formSchema>;

const LoginForm = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    // ... rest of the existing code remains the same
  };

  const handleForgotPassword = async () => {
    // Use type assertion to ensure email exists
    const email = form.getValues("email");
    
    if (!email || !z.string().email().safeParse(email).success) {
      showError("Por favor, insira um email válido para recuperar a senha.");
      return;
    }

    // ... rest of the existing code remains the same
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* ... rest of the existing code remains the same */}
      </form>
    </Form>
  );
};

export default LoginForm;
"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").min(1, "Email obrigatório"),
  cpf: z.string().min(11, "CPF obrigatório").max(14, "CPF inválido"),
  whatsapp: z.string().min(8, "WhatsApp obrigatório"),
});

type FormData = z.infer<typeof formSchema>;

const CreateCustomerForm = ({ onCreated }: { onCreated?: () => void }) => {
  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      email: "",
      cpf: "",
      whatsapp: "",
    },
  });

  const onSubmit = async (data: FormData) => {
    // Normalize fields
    const cpfClean = data.cpf.replace(/[^\d]+/g, "");
    const whatsappClean = data.whatsapp.replace(/\D/g, "");

    try {
      const payload = {
        email: data.email,
        name: data.name,
        cpf: cpfClean,
        whatsapp: whatsappClean,
      };

      // Chamada da edge function admin (service role) para criar usuário + perfil
      const { data: resp, error } = await supabase.functions.invoke("create-customer", {
        body: payload,
      });

      if (error) {
        showError("Erro ao criar cliente: " + error.message);
        console.error("Create customer error:", error);
      } else {
        showSuccess("Cliente criado com sucesso!");
        form.reset();
        if (onCreated) onCreated();
      }
    } catch (err: any) {
      showError("Erro ao criar cliente.");
      console.error("Create customer exception:", err);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input placeholder="Nome completo" {...field} />
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
                  <Input placeholder="email@exemplo.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="cpf"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CPF</FormLabel>
                <FormControl>
                  <Input placeholder="00000000000" {...field} />
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
                  <Input placeholder="(XX) XXXXX-XXXX" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button type="submit" className="bg-green-600 hover:bg-green-700 text-white">
            Criar Cliente
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateCustomerForm;
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
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { formatCPF } from "@/utils/cpfValidation";
import { formatWhatsapp } from "@/utils/whatsappValidation";
import { Loader2 } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(1, "Nome obrigatório"),
  email: z.string().email("Email inválido").min(1, "Email obrigatório"),
  cpf: z
    .string()
    .min(14, "CPF obrigatório")
    .max(14, "CPF inválido")
    .regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido"),
  whatsapp: z
    .string()
    .min(15, "WhatsApp obrigatório")
    .max(15, "WhatsApp inválido")
    .regex(/^\(\d{2}\) \d{4,5}-\d{4}$/, "WhatsApp inválido"),
});

type FormData = z.infer<typeof formSchema>;

interface CreateCustomerFormProps {
  onCreated?: () => void;
}

const CreateCustomerForm = ({ onCreated }: CreateCustomerFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const cpfClean = data.cpf.replace(/[^\d]+/g, '');
    const whatsappClean = data.whatsapp.replace(/\D/g, '');

    setIsSubmitting(true);
    
    try {
      // ETAPA 1: Log do início da criação
      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-create-customer-start',
        message: 'Admin started manual customer creation',
        metadata: { 
          email: data.email.toLowerCase().trim(),
          name: data.name,
          cpfLength: cpfClean.length,
          whatsappLength: whatsappClean.length,
          adminEmail: (await supabase.auth.getUser()).data.user?.email
        }
      });

      const { data: result, error } = await supabase.functions.invoke("create-customer", {
        body: {
          email: data.email.toLowerCase().trim(),
          name: data.name,
          cpf: cpfClean,
          whatsapp: whatsappClean,
        },
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-create-customer-edge-error',
          message: 'Edge function error during customer creation',
          metadata: { 
            email: data.email.toLowerCase().trim(),
            error: error.message,
            errorType: error.name
          }
        });
        showError("Erro ao criar cliente: " + error.message);
        console.error("Create customer error:", error);
        return;
      }

      if (result?.error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-create-customer-business-error',
          message: 'Business logic error during customer creation',
          metadata: { 
            email: data.email.toLowerCase().trim(),
            businessError: result.error,
            errorType: 'business_validation'
          }
        });
        showError(result.error);
        return;
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-create-customer-success',
        message: 'Manual customer creation completed successfully',
        metadata: { 
          userId: result.userId,
          email: data.email.toLowerCase().trim(),
          name: data.name,
          adminEmail: (await supabase.auth.getUser()).data.user?.email
        }
      });

      showSuccess("Cliente criado com sucesso!");
      form.reset();
      if (onCreated) onCreated();
    } catch (err: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-create-customer-unhandled',
        message: 'Unhandled error during customer creation',
        metadata: { 
          email: data.email.toLowerCase().trim(),
          error: err.message,
          errorStack: err.stack
        }
      });
      showError("Erro ao criar cliente: " + err.message);
      console.error("Create customer exception:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Nome completo"
                    {...field}
                    disabled={isSubmitting}
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
                    placeholder="email@exemplo.com"
                    {...field}
                    disabled={isSubmitting}
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
                    maxLength={14}
                    {...field}
                    disabled={isSubmitting}
                    onChange={(event) => field.onChange(formatCPF(event.target.value))}
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
                    maxLength={15}
                    {...field}
                    disabled={isSubmitting}
                    onChange={(event) => field.onChange(formatWhatsapp(event.target.value))}
                    className="focus:ring-orange-500 focus:border-orange-500"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <p className="text-xs text-slate-500">
          Após criado, o cliente recebe acesso com a senha padrão (CPF sem formatação) e pode ser atualizado a qualquer momento.
        </p>

        <div className="flex justify-end">
          <Button
            type="submit"
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </span>
            ) : (
              "Criar Cliente"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreateCustomerForm;
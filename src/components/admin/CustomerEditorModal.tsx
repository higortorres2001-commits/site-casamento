"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";
import { Loader2, KeyRound, MailOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";

interface CustomerEditorModalProps {
  open: boolean;
  onClose: () => void;
  customer: any; // Profile with id, name, email, access, cpf
  products: { id: string; name: string }[];
  onSave: (payload: { id: string; name?: string; email?: string; access?: string[] | null }) => void;
  onRemoveAccess?: () => void;
  onPasswordReset: () => void; // Novo callback para forçar o refresh após reset
}

const CustomerEditorModal = ({
  open,
  onClose,
  customer,
  products,
  onSave,
  onRemoveAccess,
  onPasswordReset,
}: CustomerEditorModalProps) => {
  const [name, setName] = useState<string>(customer?.name ?? "");
  const [email, setEmail] = useState<string>(customer?.email ?? "");
  const [cpf, setCpf] = useState<string>(customer?.cpf ?? "");
  const [selected, setSelected] = useState<string[]>(customer?.access ?? []);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false); // Novo estado

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setCpf(customer.cpf ?? "");
      setSelected(customer.access ?? []);
    }
  }, [customer, open]);

  const toggleProduct = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onSave({ id: customer.id, name, email, access: selected.length ? selected : [] });
  };

  const handleResetPassword = async () => {
    if (!customer?.id || !cpf) {
      showError("CPF ou ID do cliente ausente.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja redefinir a senha de ${customer.name ?? customer.email} para o CPF (${cpf})?`)) {
      return;
    }

    setIsResettingPassword(true);
    const cleanCpf = cpf.replace(/[^\d]+/g, "");

    try {
      const { error } = await supabase.functions.invoke("reset-customer-password", {
        body: {
          userId: customer.id,
          newPassword: cleanCpf,
        },
      });

      if (error) {
        showError("Erro ao redefinir senha: " + error.message);
        console.error("Reset password error:", error);
      } else {
        showSuccess("Senha redefinida com sucesso! A nova senha é o CPF do cliente.");
        onPasswordReset(); // Força o refresh da lista de clientes se necessário
        onClose();
      }
    } catch (err: any) {
      showError("Erro inesperado ao redefinir senha.");
      console.error("Unexpected reset password error:", err);
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleSendRecoveryEmail = async () => {
    if (!customer?.email) {
      showError("Email do cliente ausente.");
      return;
    }

    if (!window.confirm(`Tem certeza que deseja enviar um link de recuperação de senha para ${customer.email}?`)) {
      return;
    }

    setIsSendingRecovery(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(customer.email, {
        redirectTo: `${window.location.origin}/primeira-senha`, // Redireciona para a tela de troca de senha
      });

      if (error) {
        showError("Erro ao enviar link de recuperação: " + error.message);
        console.error("Recovery email error:", error);
      } else {
        showSuccess("Link de recuperação de senha enviado para o email do cliente!");
      }
    } catch (err: any) {
      showError("Erro inesperado ao enviar link de recuperação.");
      console.error("Unexpected recovery email error:", err);
    } finally {
      setIsSendingRecovery(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_open) => _open ? null : onClose()}>
      <DialogContent className="sm:max-w-lg p-6">
        <DialogHeader>
          <DialogTitle>Editar Cliente</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email do cliente" />
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" />
            <Label>CPF</Label>
            <Input value={cpf} disabled placeholder="CPF do cliente (somente leitura)" />
          </div>

          <div className="space-y-3">
            <Label>Acesso aos Produtos</Label>
            <div className="h-48 overflow-y-auto border rounded-md p-2">
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between py-1">
                  <span className="text-sm">{p.name}</span>
                  <Checkbox
                    checked={selected.includes(p.id)}
                    onCheckedChange={(checked) => {
                      if (checked) toggleProduct(p.id);
                      else setSelected((prev) => prev.filter((id) => id !== p.id));
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center">
            <Button
              variant="outline"
              className="text-red-600 hover:bg-red-50"
              onClick={handleResetPassword}
              disabled={isResettingPassword || !cpf || isSendingRecovery}
            >
              {isResettingPassword ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4 mr-2" />
              )}
              Redefinir Senha (CPF)
            </Button>
            
            <Button
              variant="outline"
              className="text-blue-600 hover:bg-blue-50"
              onClick={handleSendRecoveryEmail}
              disabled={isSendingRecovery || !email || isResettingPassword}
            >
              {isSendingRecovery ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <MailOpen className="h-4 w-4 mr-2" />
              )}
              Enviar Link de Recuperação
            </Button>
          </div>
          
          <DialogFooter className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white">
              Salvar Cliente
            </Button>
          </DialogFooter>
        </div>

        {onRemoveAccess && (
          <div className="mt-3 text-right">
            <Button variant="destructive" onClick={onRemoveAccess} className="text-white bg-red-500 hover:bg-red-600">
              Remover todos os acessos
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditorModal;
"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess } from "@/utils/toast";
import { Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";

interface CustomerEditorModalProps {
  open: boolean;
  onClose: () => void;
  customer: any;
  products: { id: string; name: string }[];
  onRefresh: () => void;
}

const CustomerEditorModal = ({
  open,
  onClose,
  customer,
  products,
  onRefresh,
}: CustomerEditorModalProps) => {
  const [name, setName] = useState<string>(customer?.name ?? "");
  const [email, setEmail] = useState<string>(customer?.email ?? "");
  const [selected, setSelected] = useState<string[]>(customer?.access ?? []);
  const [isAdmin, setIsAdmin] = useState<boolean>(customer?.is_admin ?? false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (customer) {
      const originalName = customer.name ?? "";
      const originalEmail = customer.email ?? "";
      const originalAccess = Array.isArray(customer.access) ? customer.access : [];
      const originalIsAdmin = customer.is_admin ?? false;

      setName(originalName);
      setEmail(originalEmail);
      setSelected(originalAccess);
      setIsAdmin(originalIsAdmin);

      // Log inicial do estado
      console.log('CustomerEditorModal - Initial state loaded:', {
        customerId: customer.id,
        originalName,
        originalEmail,
        originalAccessCount: originalAccess.length,
        originalIsAdmin
      });
    }
  }, [customer, open]);

  const toggleProduct = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleResetPassword = async () => {
    if (!customer?.id) return;

    if (!window.confirm("Tem certeza que deseja redefinir a senha para o CPF do usuário?")) return;

    setIsLoading(true);
    
    try {
      // Log da tentativa de reset
      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-password-reset-start',
        message: 'Admin initiated password reset',
        metadata: { 
          targetUserId: customer.id,
          targetEmail: customer.email,
          adminEmail: (await supabase.auth.getUser()).data.user?.email
        }
      });

      const { data, error } = await supabase.functions.invoke("reset-user-password", {
        body: { userId: customer.id },
      });

      if (error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-password-reset-error',
          message: 'Failed to reset password via edge function',
          metadata: { 
            targetUserId: customer.id,
            error: error.message,
            errorType: error.name
          }
        });
        showError("Erro ao redefinir senha: " + error.message);
        console.error("Password reset error:", error);
        return;
      }

      if (data?.error) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-password-reset-error',
          message: 'Edge function returned error for password reset',
          metadata: { 
            targetUserId: customer.id,
            edgeFunctionError: data.error
          }
        });
        showError(data.error);
        return;
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-password-reset-success',
        message: 'Password reset completed successfully',
        metadata: { 
          targetUserId: customer.id,
          targetEmail: customer.email
        }
      });

      showSuccess("Senha redefinida para o CPF do usuário!");
      onRefresh();
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-password-reset-unhandled',
        message: 'Unhandled error during password reset',
        metadata: { 
          targetUserId: customer.id,
          error: error.message,
          errorStack: error.stack
        }
      });
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    try {
      // Log do início da atualização
      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-user-update-start',
        message: 'Admin started user profile update',
        metadata: { 
          targetUserId: customer.id,
          changes: {
            name: { from: customer.name, to: name },
            email: { from: customer.email, to: email },
            access: { 
              from: Array.isArray(customer.access) ? customer.access.length : 0, 
              to: selected.length 
            },
            is_admin: { from: customer.is_admin, to: isAdmin }
          },
          adminEmail: (await supabase.auth.getUser()).data.user?.email
        }
      });

      // ETAPA 1: Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ 
          name, 
          email: email.toLowerCase().trim(), 
          access: selected, 
          is_admin: isAdmin,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id)
        .select()
        .single();

      if (profileError) {
        await supabase.from('logs').insert({
          level: 'error',
          context: 'admin-user-profile-update-error',
          message: 'Failed to update user profile',
          metadata: { 
            targetUserId: customer.id,
            error: profileError.message,
            errorType: profileError.name,
            errorCode: profileError.code,
            attemptedChanges: {
              name, 
              email: email.toLowerCase().trim(), 
              access: selected, 
              is_admin: isAdmin
            }
          }
        });
        showError("Erro ao salvar perfil: " + profileError.message);
        console.error("Profile update error:", profileError);
        return;
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-user-profile-update-success',
        message: 'User profile updated successfully',
        metadata: { 
          targetUserId: customer.id,
          updatedProfile: profileError ? null : {
            name, 
            email: email.toLowerCase().trim(), 
            accessCount: selected.length, 
            is_admin: isAdmin
          }
        }
      });

      // ETAPA 2: Atualizar email no auth se mudou
      if (email.toLowerCase().trim() !== customer.email?.toLowerCase().trim()) {
        await supabase.from('logs').insert({
          level: 'info',
          context: 'admin-user-auth-update-start',
          message: 'Starting auth email update',
          metadata: { 
            targetUserId: customer.id,
            oldEmail: customer.email,
            newEmail: email.toLowerCase().trim()
          }
        });

        const { error: emailError } = await supabase.auth.admin.updateUserById(
          customer.id,
          { email: email.toLowerCase().trim() }
        );
        
        if (emailError) {
          await supabase.from('logs').insert({
            level: 'error',
            context: 'admin-user-auth-update-error',
            message: 'Failed to update auth email',
            metadata: { 
              targetUserId: customer.id,
              oldEmail: customer.email,
              newEmail: email.toLowerCase().trim(),
              error: emailError.message,
              errorType: emailError.name
            }
          });
          showError("Erro ao atualizar email: " + emailError.message);
          console.error("Email update error:", emailError);
          // Continuar mesmo assim - o perfil foi atualizado
        } else {
          await supabase.from('logs').insert({
            level: 'info',
            context: 'admin-user-auth-update-success',
            message: 'Auth email updated successfully',
            metadata: { 
              targetUserId: customer.id,
              newEmail: email.toLowerCase().trim()
            }
          });
        }
      }

      await supabase.from('logs').insert({
        level: 'info',
        context: 'admin-user-update-complete',
        message: 'User update process completed successfully',
        metadata: { 
          targetUserId: customer.id,
          finalEmail: email.toLowerCase().trim(),
          finalAccessCount: selected.length,
          finalIsAdmin: isAdmin
        }
      });

      showSuccess("Perfil atualizado com sucesso!");
      onRefresh();
      onClose();
    } catch (error: any) {
      await supabase.from('logs').insert({
        level: 'error',
        context: 'admin-user-update-unhandled',
        message: 'Unhandled error during user update',
        metadata: { 
          targetUserId: customer.id,
          error: error.message,
          errorStack: error.stack
        }
      });
      showError("Erro inesperado: " + error.message);
      console.error("Unexpected error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => nextOpen ? null : onClose()}>
      <DialogContent className="sm:max-w-2xl p-6">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Informações Pessoais */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Informações Pessoais</h3>
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input 
                  value={name} 
                  onChange={(e) => setName(e.target.value)} 
                  placeholder="Nome completo" 
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)} 
                  placeholder="Email" 
                  type="email" 
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch 
                  checked={isAdmin}
                  onCheckedChange={setIsAdmin}
                />
                <Label>Usuário Administrador</Label>
              </div>
            </div>
          </div>

          {/* Acessos */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Acessos aos Produtos</h3>
            <div className="border rounded-md p-3 max-h-64 overflow-y-auto">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500">Nenhum produto disponível</p>
              ) : (
                products.map((p) => (
                  <div 
                    key={p.id} 
                    className="flex items-center justify-between py-2 border-b last:border-b-0"
                  >
                    <span>{p.name}</span>
                    <Checkbox
                      checked={selected.includes(p.id)}
                      onCheckedChange={() => toggleProduct(p.id)}
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-6 flex flex-col sm:flex-row justify-between">
          <Button 
            variant="destructive" 
            onClick={handleResetPassword}
            disabled={isLoading}
            className="w-full sm:w-auto mb-2 sm:mb-0"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              "Redefinir Senha para CPF"
            )}
          </Button>
          <div className="flex space-x-2">
            <Button 
              variant="outline" 
              onClick={onClose} 
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isLoading}
              className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                "Salvar Alterações"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditorModal;
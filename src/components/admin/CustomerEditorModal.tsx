"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Product } from "@/types";

interface CustomerEditorModalProps {
  open: boolean;
  onClose: () => void;
  customer: any; // Profile with id, name, email, access
  products: { id: string; name: string }[];
  onSave: (payload: { id: string; name?: string; email?: string; access?: string[] | null }) => void;
  onRemoveAccess?: () => void;
}

const CustomerEditorModal = ({
  open,
  onClose,
  customer,
  products,
  onSave,
  onRemoveAccess,
}: CustomerEditorModalProps) => {
  const [name, setName] = useState<string>(customer?.name ?? "");
  const [email, setEmail] = useState<string>(customer?.email ?? "");
  const [selected, setSelected] = useState<string[]>(customer?.access ?? []);

  useEffect(() => {
    if (customer) {
      setName(customer.name ?? "");
      setEmail(customer.email ?? "");
      setSelected(customer.access ?? []);
    }
  }, [customer, open]);

  const toggleProduct = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleSave = () => {
    onSave({ id: customer.id, name, email, access: selected.length ? selected : [] });
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

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} className="bg-orange-500 hover:bg-orange-600 text-white">
            Salvar Cliente
          </Button>
        </DialogFooter>

        {onRemoveAccess && (
          <div className="mt-3 text-right">
            <Button variant="danger" onClick={onRemoveAccess} className="text-white bg-red-500 hover:bg-red-600">
              Remover todos os acessos
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerEditorModal;
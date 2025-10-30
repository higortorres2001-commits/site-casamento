"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, X } from "lucide-react";
import { showError, showSuccess } from "@/utils/toast";

interface MassAccessModalProps {
  open: boolean;
  onClose: () => void;
  customers: { id: string; name?: string; email?: string }[];
  products: { id: string; name: string }[];
  onApply: (productIds: string[], customerIds: string[]) => void;
}

const MassAccessModal = ({
  open,
  onClose,
  customers,
  products,
  onApply,
}: MassAccessModalProps) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  useEffect(() => {
    if (open) {
      setSelectedProductIds([]);
      setSelectedCustomerIds([]);
    }
  }, [open]);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleCustomer = (id: string) => {
    setSelectedCustomerIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const apply = async () => {
    if (selectedProductIds.length === 0) {
      showError("Selecione pelo menos um produto.");
      return;
    }
    if (selectedCustomerIds.length === 0) {
      showError("Selecione pelo menos um cliente.");
      return;
    }
    setIsApplying(true);
    try {
      await onApply(selectedProductIds, selectedCustomerIds);
      showSuccess("Acesso aplicado com sucesso!");
      onClose();
    } catch (e) {
      showError("Erro ao aplicar acesso.");
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_open) => _open ? null : onClose()}>
      <DialogContent className="sm:max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle>Acesso em Massa</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold mb-2">Clientes</h4>
            <div className="border rounded-md p-2 h-64 overflow-y-auto bg-white">
              {customers.length === 0 && (
                <p className="text-sm text-gray-500 p-2">Nenhum cliente.</p>
              )}
              {customers.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                  <span className="text-sm">
                    {c.name ?? c.email ?? c.id}
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedCustomerIds.includes(c.id)}
                    onChange={() => toggleCustomer(c.id)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold mb-2">Produtos</h4>
            <div className="border rounded-md p-2 h-64 overflow-y-auto bg-white">
              {products.length === 0 && (
                <p className="text-sm text-gray-500 p-2">Nenhum produto.</p>
              )}
              {products.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md">
                  <span className="text-sm">{p.name}</span>
                  <input
                    type="checkbox"
                    checked={selectedProductIds.includes(p.id)}
                    onChange={() => toggleProduct(p.id)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={isApplying}>
            Cancelar
          </Button>
          <Button onClick={apply} className="bg-green-600 hover:bg-green-700 text-white" disabled={isApplying}>
            {isApplying ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Aplicando...
              </span>
            ) : (
              "Aplicar Acesso"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MassAccessModal;
"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Check } from "lucide-react";
import { Product } from "@/types";

interface MassAccessModalProps {
  open: boolean;
  onClose: () => void;
  customers: any[];
  products: { id: string; name: string }[];
  onApply: (productIds: string[]) => void;
}

const MassAccessModal = ({
  open,
  onClose,
  customers,
  products,
  onApply,
}: MassAccessModalProps) => {
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [isApplying, setIsApplying] = useState(false);

  const toggleProduct = (id: string) => {
    setSelectedProductIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const apply = async () => {
    if (selectedProductIds.length === 0) return;
    setIsApplying(true);
    await onApply(selectedProductIds);
    setIsApplying(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_open) => _open ? null : onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Acesso em Massa</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            Escolha os produtos que deseja conceder aos clientes selecionados.
          </p>
          <div className="h-40 overflow-y-auto border rounded-md p-2">
            {products.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-1">
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

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={apply} className="bg-green-600 hover:bg-green-700 text-white" disabled={isApplying || selectedProductIds.length === 0}>
            {isApplying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Aplicar Acesso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MassAccessModal;
"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";

interface ProductTagModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  onUpdated: () => void;
}

const ProductTagModal = ({ open, onClose, product, onUpdated }: ProductTagModalProps) => {
  const [tag, setTag] = useState<string>(product?.internal_tag ?? "");

  useEffect(() => {
    if (product) setTag(product.internal_tag ?? "");
  }, [product, open]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!product) return;
    try {
      const newTag = tag?.trim() || null; // permite limpar tag
      const { error } = await supabase
        .from("products")
        .update({ internal_tag: newTag })
        .eq("id", product.id);

      if (error) {
        showError("Erro ao atualizar tag do produto: " + error.message);
      } else {
        showSuccess("Tag atualizada com sucesso!");
        onUpdated();
        // O modal permanece aberto para edição adicional
      }
    } catch (err) {
      showError("Erro ao atualizar tag.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => { /* suprime fechamento por overlay */ }}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Editar Tag do Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nome da tag" />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
            <Button type="submit" className="bg-blue-600 text-white">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductTagModal;
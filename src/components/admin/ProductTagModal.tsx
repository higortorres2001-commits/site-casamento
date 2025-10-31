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
  onSaved: (newTag: string | null) => void; // Atualiza localmente a tag no item da lista
}

const ProductTagModal = ({ open, onClose, product, onSaved }: ProductTagModalProps) => {
  const [tag, setTag] = useState<string>(product?.internal_tag ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) setTag(product.internal_tag ?? "");
  }, [product, open]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!product || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const newTag = tag?.trim() || null;
      const { error } = await supabase
        .from("products")
        .update({ internal_tag: newTag })
        .eq("id", product.id);

      if (error) {
        showError("Erro ao atualizar tag do produto: " + error.message);
      } else {
        showSuccess("Tag atualizada com sucesso!");
        onSaved(newTag);
        onClose();
      }
    } catch {
      showError("Erro ao atualizar tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const removeTag = async () => {
    if (!product || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("products")
        .update({ internal_tag: null })
        .eq("id", product.id);

      if (error) {
        showError("Erro ao apagar tag: " + error.message);
      } else {
        showSuccess("Tag apagada com sucesso!");
        onSaved(null);
        onClose();
      }
    } catch {
      showError("Erro ao apagar tag.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>Editar Tag do Produto</DialogTitle>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag (opcional)</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ex.: premium, vip, interno..."
              disabled={isSubmitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              Deixe em branco para remover a tag; ou use o botão Apagar Tag abaixo.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={removeTag}
              disabled={isSubmitting}
            >
              Apagar Tag
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={onClose} disabled={isSubmitting}>
                Fechar
              </Button>
              <Button type="submit" className="bg-blue-600 text-white" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductTagModal;
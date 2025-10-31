"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";
import { supabase } from "@/integrations/supabase/client";
import { Product } from "@/types";

interface ProductTagModalProps {
  open: boolean;
  onClose: () => void;
  product: Product;
  onSaved: (newTag: string | null) => void; // retorna tag salva para atualizar localmente
}

const ProductTagModal = ({ open, onClose, product, onSaved }: ProductTagModalProps) => {
  const [tag, setTag] = useState<string>(product?.internal_tag ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (product) setTag(product.internal_tag ?? "");
  }, [product, open]);

  const save = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!product) return;
    setSaving(true);
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
        onSaved(newTag); // atualiza lista localmente
        onClose(); // fecha modal imediatamente
      }
    } catch (err: any) {
      showError("Erro ao atualizar tag.");
    } finally {
      setSaving(false);
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
          <div className="flex items-center justify-between w-full">
            <DialogTitle>Editar Tag do Produto</DialogTitle>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="text-gray-500 hover:text-gray-700 p-1 rounded"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </DialogHeader>

        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag (opcional)</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ex.: premium, vip, interno..."
              disabled={saving}
            />
            <p className="text-xs text-gray-500 mt-1">
              Deixe em branco para remover a tag deste produto.
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Fechar
            </Button>
            <Button type="submit" className="bg-blue-600 text-white" disabled={saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProductTagModal;
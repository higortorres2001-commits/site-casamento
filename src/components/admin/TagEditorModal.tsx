"use client";

import React, { useEffect, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

type Tag = { id?: string; tag: string };

interface TagEditorModalProps {
  open: boolean;
  onClose: () => void;
  initialTag?: Tag;
  onSave: (payload: { id?: string; tag: string }) => void | Promise<void>;
  isLoading?: boolean;
}

const TagEditorModal = ({
  open,
  onClose,
  initialTag,
  onSave,
  isLoading,
}: TagEditorModalProps) => {
  const [tag, setTag] = useState<string>(initialTag?.tag ?? "");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialTag) {
      setTag(initialTag.tag);
    } else {
      setTag("");
    }
    // Reset status message when the modal opens/closes or when initialTag muda
    setStatusMessage(null);
  }, [initialTag, open]);

  const handleSubmit = async () => {
    if (!tag.trim()) return;
    const payload = { id: initialTag?.id, tag: tag.trim() };
    const result = onSave(payload);
    if (result && typeof (result as any).then === "function") {
      await (result as Promise<void>);
    }
    // Mantém o modal aberto intencionalmente para UX de edição inline
    setStatusMessage("Tag salva com sucesso.");
    setTimeout(() => setStatusMessage(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      // Previne fechamento automático do modal via overlay/ESC
      if (!nextOpen) {
        // Não chamar onClose para manter o modal aberto
      }
    }}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{initialTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSubmit();
          }}
          className="space-y-4 mt-2"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <Input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Nome da tag"
            />
          </div>

          {statusMessage && (
            <div className="text-sm text-green-600">{statusMessage}</div>
          )}

          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 text-white" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </span>
              ) : (
                "Salvar"
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TagEditorModal;
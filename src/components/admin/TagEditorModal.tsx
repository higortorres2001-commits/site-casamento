"use client";

import React, { useEffect, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { showSuccess } from "@/utils/toast";

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
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialTag) {
      setTag(initialTag.tag);
    } else {
      setTag("");
    }
  }, [initialTag, open]);

  const handleSubmit = async () => {
    if (!tag.trim()) return;
    setIsSaving(true);
    const payload = { id: initialTag?.id, tag: tag.trim() };
    try {
      await onSave(payload);
      // onSave agora deve lidar com o fechamento do modal e o refresh da lista
    } catch (e) {
      // Erro tratado em ProductTags.tsx
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      if (!nextOpen) {
        onClose();
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
              disabled={isSaving || isLoading}
            />
          </div>

          <div className="mt-4 flex justify-end space-x-2">
            <Button variant="outline" type="button" onClick={onClose} disabled={isSaving || isLoading}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-600 text-white" disabled={isSaving || isLoading}>
              {isSaving ? (
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
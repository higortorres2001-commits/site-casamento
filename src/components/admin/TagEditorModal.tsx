"use client";

import React, { useEffect, useState } from "react";
import { DialogContent, DialogHeader, DialogTitle, Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";

type Tag = { id: string; tag: string; description?: string; created_at?: string };

interface TagEditorModalProps {
  open: boolean;
  onClose: () => void;
  initialTag?: Tag;
  onSave: (payload: { id?: string; tag: string; description?: string }) => void;
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
  const [description, setDescription] = useState<string>(initialTag?.description ?? "");

  useEffect(() => {
    if (initialTag) {
      setTag(initialTag.tag);
      setDescription(initialTag.description ?? "");
    } else {
      setTag("");
      setDescription("");
    }
  }, [initialTag, open]);

  const handleSubmit = () => {
    if (!tag.trim()) return;
    onSave({ id: initialTag?.id, tag: tag.trim(), description: description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(_open) => _open ? null : onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader>
          <DialogTitle>{initialTag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tag</label>
            <Input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="Nome da tag" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (opcional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder=" Observação interna" rows={3} />
          </div>
        </div>
        <div className="mt-4 flex justify-end space-x-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-blue-600 text-white" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TagEditorModal;
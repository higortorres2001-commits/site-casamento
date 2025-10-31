"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag } from "@/types";

interface TagEditorModalProps {
  open: boolean;
  onClose: () => void;
  tag?: Tag;
  onSubmit: (payload: { id?: string; name: string; color?: string }) => void;
}

const TagEditorModal = ({ open, onClose, tag, onSubmit }: TagEditorModalProps) => {
  const [name, setName] = useState<string>(tag?.name ?? "");
  const [color, setColor] = useState<string>(tag?.color ?? "#e879f9"); // cor default suave

  useEffect(() => {
    if (tag) {
      setName(tag.name);
      setColor(tag.color ?? "#e879f9");
    } else {
      setName("");
      setColor("#e879f9");
    }
  }, [tag, open]);

  const handleSubmit = () => {
    onSubmit({ id: tag?.id, name: name.trim(), color: color });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(_open) => !_open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tag ? "Editar Tag" : "Nova Tag"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Nome da Tag</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Desconto especial" />
          </div>
          <div>
            <Label>Cor (opcional)</Label>
            <Input value={color} onChange={(e) => setColor(e.target.value)} placeholder="#ff00aa" />
          </div>
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-600 text-white">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default TagEditorModal;
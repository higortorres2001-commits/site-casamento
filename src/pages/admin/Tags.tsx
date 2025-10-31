"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import TagEditorModal from "@/components/admin/TagEditorModal";
import { Tag } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { showError, showSuccess } from "@/utils/toast";

const Tags = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | undefined>(undefined);

  const fetchTags = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("tags").select("*").order("name", { ascending: true });
    if (error) {
      showError("Erro ao carregar tags: " + error.message);
      setTags([]);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreateTag = () => {
    setEditingTag(undefined);
    setIsModalOpen(true);
  };

  const handleEditTag = (tag: Tag) => {
    setEditingTag(tag);
    setIsModalOpen(true);
  };

  const handleDeleteTag = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tag?")) return;
    const { error } = await supabase.from("tags").delete().eq("id", id);
    if (error) {
      showError("Erro ao excluir tag: " + error.message);
    } else {
      showSuccess("Tag removida com sucesso!");
      fetchTags();
    }
  };

  const handleSubmitTag = async (payload: { id?: string; name: string; color?: string }) => {
    if (payload.id) {
      // Update
      const { error } = await supabase.from("tags").update({ name: payload.name, color: payload.color }).eq("id", payload.id);
      if (error) {
        showError("Erro ao atualizar tag: " + error.message);
      } else {
        showSuccess("Tag atualizada!");
        fetchTags();
      }
    } else {
      // Create
      const { error } = await supabase.from("tags").insert({ name: payload.name, color: payload.color }).single();
      if (error) {
        showError("Erro ao criar tag: " + error.message);
      } else {
        showSuccess("Tag criada!");
        fetchTags();
      }
    }
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Gerenciar Tags de Produtos</h1>
        <Button onClick={handleCreateTag} className="bg-blue-600 hover:bg-blue-700 text-white">
          + Nova Tag
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="rounded-md border bg-white shadow-sm overflow-x-auto">
          <Table>
            <TableHeader className="bg-gray-50">
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Cor</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags.map((t) => (
                <TableRow key={t.id} className="hover:bg-gray-50">
                  <TableCell className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: t.color || '#d1d5db' }} />
                    <span>{t.name}</span>
                  </TableCell>
                  <TableCell>
                    <span className="px-2 py-1 rounded bg-gray-100" style={{ backgroundColor: t.color || '#e5e7eb' }}>
                      {t.color || 'Padrão'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" className="mr-2" onClick={() => handleEditTag(t)}>Editar</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteTag(t.id)} className="text-red-600 hover:text-red-800">Excluir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <TagEditorModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        tag={editingTag}
        onSubmit={handleSubmitTag}
      />
    </div>
  );
};

export default Tags;
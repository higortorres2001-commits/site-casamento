"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Edit } from "lucide-react";
import { useSession } from "@/components/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import TagEditorModal from "../../components/admin/TagEditorModal";
import Brand from "../../components/Brand";

type Tag = {
  id: string;
  tag: string;
  description?: string;
  created_at?: string;
};

const ProductTags = () => {
  const { user, isLoading: isSessionLoading } = useSession();
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEditor, setOpenEditor] = useState(false);
  const [editingTag, setEditingTag] = useState<Tag | undefined>(undefined);
  const [newTag, setNewTag] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const isAdmin = !!user;

  const fetchTags = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_tags")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching product tags:", error);
      setTags([]);
    } else {
      setTags(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!isSessionLoading && isAdmin) {
      fetchTags();
    }
  }, [isSessionLoading, isAdmin]);

  const createTag = async () => {
    if (!newTag.trim()) return;

    const { error } = await supabase
      .from("product_tags")
      .insert({
        tag: newTag.trim(),
        description: newDesc.trim() || null,
      });

    if (error) {
      console.error("Error creating tag:", error);
      return;
    }

    setNewTag("");
    setNewDesc("");
    fetchTags();
  };

  const deleteTag = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tag?")) return;

    const { error } = await supabase.from("product_tags").delete().eq("id", id);

    if (error) {
      console.error("Error deleting tag:", error);
      return;
    }

    fetchTags();
  };

  const openEditModal = (tag: Tag) => {
    setEditingTag(tag);
    setOpenEditor(true);
  };

  const saveEditedTag = async (payload: { id?: string; tag: string; description?: string }) => {
    if (!payload.tag.trim() || !payload.id) return;

    const { error } = await supabase
      .from("product_tags")
      .update({
        tag: payload.tag.trim(),
        description: payload.description?.trim() || null,
      })
      .eq("id", payload.id);

    if (error) {
      console.error("Error updating tag:", error);
      return;
    }

    setOpenEditor(false);
    setEditingTag(undefined);
    fetchTags();
  };

  return (
    <div className="container mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Brand />
          <h1 className="text-3xl font-bold">Gerenciar Tags de Produtos</h1>
        </div>
        <span className="text-sm text-gray-500">Tags usadas para classificação interna</span>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle>Adicionar Nova Tag</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row items-center gap-3">
          <input
            className="border rounded-md p-2 w-full sm:flex-1"
            placeholder="Nova tag (ex: premium, vip, etc.)"
            value={newTag}
            onChange={(event) => setNewTag(event.target.value)}
          />
          <input
            className="border rounded-md p-2 w-full sm:flex-2"
            placeholder="Descrição opcional"
            value={newDesc}
            onChange={(event) => setNewDesc(event.target.value)}
          />
          <Button onClick={createTag} className="bg-blue-600 hover:bg-blue-700 text-white">
            Adicionar Tag
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Tags Existentes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center p-6">
              <div className="h-6 w-6 animate-pulse rounded-full bg-gray-300" />
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Tag</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tags.map((tagItem) => (
                  <TableRow key={tagItem.id}>
                    <TableCell className="font-medium">{tagItem.tag}</TableCell>
                    <TableCell>{tagItem.description ?? "—"}</TableCell>
                    <TableCell>
                      {tagItem.created_at
                        ? new Date(tagItem.created_at).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mr-2"
                        onClick={() => openEditModal(tagItem)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTag(tagItem.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TagEditorModal
        open={openEditor}
        onClose={() => {
          setOpenEditor(false);
          setEditingTag(undefined);
        }}
        initialTag={editingTag}
        onSave={saveEditedTag}
      />
    </div>
  );
};

export default ProductTags;
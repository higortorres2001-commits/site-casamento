"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import TagEditorModal from "@/components/admin/TagEditorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { showError, showSuccess } from "@/utils/toast";

type TagOption = {
  id: string;
  tag: string;
};

interface ProductTagSelectorProps {
  value?: string;
  onSelectTag?: (tag?: string) => void;
  disabled?: boolean;
}

const ProductTagSelector: React.FC<ProductTagSelectorProps> = ({
  value,
  onSelectTag,
  disabled,
}) => {
  const [tags, setTags] = useState<TagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  const fetchTags = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("product_tags").select("id, tag").order("tag", { ascending: true });
    if (error) {
      console.error("Error loading product tags:", error);
      setTags([]);
    } else {
      setTags((data ?? []) as TagOption[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleSaveTag = async (payload: { id?: string; tag: string; }) => {
    if (!payload.tag?.trim()) return;
    try {
      if (payload.id) {
        const { error } = await supabase.from("product_tags").update({ tag: payload.tag.trim() }).eq("id", payload.id);
        if (error) throw error;
        showSuccess("Tag atualizada com sucesso!");
      } else {
        const { error } = await supabase.from("product_tags").insert({ tag: payload.tag.trim() });
        if (error) throw error;
        showSuccess("Nova tag criada com sucesso!");
      }
      await fetchTags();
      setIsTagModalOpen(false); // Fecha o modal após salvar
    } catch (err: any) {
      showError("Erro ao salvar tag: " + err.message);
      console.error("Error saving tag inline:", err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    onSelectTag?.(selected ? selected : undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <select value={value ?? ""} onChange={handleChange} disabled={disabled || loading} className="block w-full rounded-md border border-gray-300 p-2" >
        <option value="">Selecionar tag</option>
        {tags.map((t) => (<option key={t.id} value={t.tag}>{t.tag}</option>))}
      </select>

      <Button variant="ghost" onClick={() => setIsTagModalOpen(true)} disabled={disabled} title="Criar nova tag">Nova Tag</Button>

      <TagEditorModal
        open={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        initialTag={undefined}
        onSave={handleSaveTag}
        isLoading={loading}
      />
    </div>
  );
};

export default ProductTagSelector;
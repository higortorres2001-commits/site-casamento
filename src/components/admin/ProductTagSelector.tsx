"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

import TagEditorModal from "@/components/admin/TagEditorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("product_tags").select("id, tag").order("tag", { ascending: true });
      if (error) {
        console.error("Error loading product tags:", error);
        setTags([]);
      } else {
        setTags((data ?? []) as TagOption[]);
      }
      setLoading(false);
    })();
  }, []);

  const deleteInlineTag = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta tag?")) return;
    await supabase.from("product_tags").delete().eq("id", id);
    // refresh list
    const { data, error } = await supabase.from("product_tags").select("id, tag").order("tag", { ascending: true });
    if (!error) setTags((data ?? []) as TagOption[]);
  };

  const handleSaveTag = async (payload: { id?: string; tag: string; }) => {
    if (!payload.tag?.trim()) return;
    try {
      if (payload.id) {
        await supabase.from("product_tags").update({ tag: payload.tag.trim() }).eq("id", payload.id);
      } else {
        await supabase.from("product_tags").insert({ tag: payload.tag.trim() });
      }
      // refresh tags
      const { data, error } = await supabase.from("product_tags").select("id, tag").order("tag", { ascending: true });
      if (!error) setTags((data ?? []) as TagOption[]);
    } catch (err) {
      console.error("Error saving tag inline:", err);
    }
    // Do not close the modal here to keep UX consistent with file editing flow
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
      />

      {/* Chips com delete direto no seletor */}
      <div className="flex flex-wrap items-center gap-2 ml-2">
        {tags.map(t => (
          <span key={t.id} className="inline-flex items-center bg-gray-200 text-gray-800 text-sm rounded-full px-2 py-1">
            {t.tag}
            <button aria-label="Remover tag" className="ml-1 text-red-600" onClick={() => deleteInlineTag(t.id)}>
              ×
            </button>
          </span>
        ))}
      </div>

    </div>
  );
};

export default ProductTagSelector;
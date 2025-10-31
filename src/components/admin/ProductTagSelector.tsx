"use client";

import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { tag as dummy } from "react";

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

  // Novo: controle do modal de criação
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from("product_tags")
          .select("id, tag")
          .order("tag", { ascending: true });

        if (error) {
          console.error("Error loading product tags:", error);
          setTags([]);
        } else {
          const raw = (data ?? []) as any[];
          const mapped = raw.map((t) => ({
            id: t.id,
            tag: t.tag,
          }));
          setTags(mapped);
        }
      } catch (err) {
        console.error("Unexpected error loading tags:", err);
        setTags([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Novo: salvar tag cru de criação inline
  const handleSaveTag = async (payload: { id?: string; tag: string; description?: string }) => {
    if (!payload.tag?.trim()) return;
    try {
      if (payload.id) {
        // atualizar tag existente
        const { error } = await supabase
          .from("product_tags")
          .update({ tag: payload.tag.trim(), description: payload.description ?? null })
          .eq("id", payload.id);

        if (error) {
          console.error("Error updating tag:", error);
          return;
        }
      } else {
        // criar nova tag
        const { error } = await supabase
          .from("product_tags")
          .insert({ tag: payload.tag.trim(), description: payload.description ?? null });

        if (error) {
          console.error("Error creating tag:", error);
          return;
        }
      }
      // refresh tags
      const { data, error } = await supabase
        .from("product_tags")
        .select("id, tag")
        .order("tag", { ascending: true });

      if (!error) {
        setTags(((data ?? []) as any[]).map((t) => ({
          id: t.id,
          tag: t.tag,
        })));
      }
    } catch (err) {
      console.error("Unexpected error saving tag:", err);
    } finally {
      setIsTagModalOpen(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    onSelectTag?.(selected ? selected : undefined);
  };

  return (
    <div className="flex items-center gap-2">
      <select
        value={value ?? ""}
        onChange={handleChange}
        disabled={disabled || loading}
        className="block w-full rounded-md border border-gray-300 p-2"
      >
        <option value="">Selecionar tag</option>
        {tags.map((t) => (
          <option key={t.id} value={t.tag}>
            {t.tag}
          </option>
        ))}
      </select>

      <Button
        variant="ghost"
        onClick={() => setIsTagModalOpen(true)}
        disabled={disabled}
        title="Criar nova tag"
      >
        Nova Tag
      </Button>

      <TagEditorModal
        open={isTagModalOpen}
        onClose={() => setIsTagModalOpen(false)}
        initialTag={undefined}
        onSave={handleSaveTag}
      />
    </div>
  );
};

export default ProductTagSelector;
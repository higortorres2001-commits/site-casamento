import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value;
    onSelectTag?.(selected ? selected : undefined);
  };

  return (
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
  );
};

export default ProductTagSelector;
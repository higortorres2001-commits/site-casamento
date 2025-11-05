"use client";

import React from "react";
import { useFormContext } from "react-hook-form";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface ProductAlsoBuyToggleProps {
  disabled?: boolean;
}

const ProductAlsoBuyToggle = ({ disabled = false }: ProductAlsoBuyToggleProps) => {
  const form = useFormContext();

  return (
    <div className="flex items-center space-x-2">
      <Switch
        id="also_buy"
        checked={form?.watch("also_buy") || false}
        onCheckedChange={(checked) => {
          form?.setValue("also_buy", checked, { shouldDirty: true });
        }}
        disabled={disabled}
      />
      <Label htmlFor="also_buy" className="text-sm font-medium">
        Exibir na seção "Compre Também"
      </Label>
    </div>
  );
};

export default ProductAlsoBuyToggle;
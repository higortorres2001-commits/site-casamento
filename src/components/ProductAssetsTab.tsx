"use client";

import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormLabel, FormMessage } from "@/components/ui/form";
import { X, FileText } from "lucide-react";
import { ProductAsset } from "@/types";
import { showError } from "@/utils/toast";

interface ProductAssetsTabProps {
  initialAssets: ProductAsset[];
  onFileChange: (files: File[]) => void;
  onDeleteAsset: (assetId: string) => void;
  isLoading: boolean;
}

const ProductAssetsTab = ({
  initialAssets,
  onFileChange,
  onDeleteAsset,
  isLoading,
}: ProductAssetsTabProps) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  useEffect(() => {
    onFileChange(selectedFiles);
  }, [selectedFiles, onFileChange]);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setSelectedFiles(Array.from(event.target.files));
    }
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <div>
        <FormLabel>Upload de Novos Arquivos (PDFs)</FormLabel>
        <Input type="file" multiple accept=".pdf" onChange={handleFileInputChange} disabled={isLoading} />
        <FormMessage />
        {selectedFiles.length > 0 && (
          <div className="mt-2 space-y-2">
            <p className="text-sm font-medium">Arquivos para upload:</p>
            {selectedFiles.map((file, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded-md bg-blue-50">
                <span>{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveSelectedFile(index)}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 text-blue-500" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {initialAssets && initialAssets.length > 0 && (
        <div className="space-y-2">
          <FormLabel>Arquivos Existentes:</FormLabel>
          {initialAssets.map((asset) => (
            <div key={asset.id} className="flex items-center justify-between p-2 border rounded-md bg-gray-50">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-gray-600" />
                <span>{asset.file_name}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteAsset(asset.id)}
                disabled={isLoading}
              >
                <X className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductAssetsTab;
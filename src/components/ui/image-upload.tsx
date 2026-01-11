import React, { useState, useRef, useCallback } from "react";
import { Upload, X, ImagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { showUserError } from "@/utils/toast";

interface ImageUploadProps {
    value?: string | null;
    onChange: (url: string | null) => void;
    bucket?: string;
    pathPrefix?: string;
    label?: string;
    aspectRatio?: "square" | "video" | "wide" | "auto";
    className?: string;
    helperText?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
    value,
    onChange,
    bucket = "wedding-assets",
    pathPrefix = "uploads",
    label = "Imagem",
    aspectRatio = "square",
    className = "",
    helperText
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getAspectRatioClass = () => {
        switch (aspectRatio) {
            case "square": return "aspect-square";
            case "video": return "aspect-video"; // 16:9
            case "wide": return "aspect-[3/1]";
            case "auto": return "aspect-auto";
            default: return "aspect-square";
        }
    };

    const optimizeImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }

                // Max dimensions
                const MAX_WIDTH = 1920;
                const MAX_HEIGHT = 1080;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
                                type: "image/webp",
                                lastModified: Date.now(),
                            });
                            resolve(newFile);
                        } else {
                            reject(new Error("Canvas conversion failed"));
                        }
                    },
                    "image/webp",
                    0.8 // Quality 80%
                );
            };
            img.onerror = (error) => reject(error);
        });
    };

    const processFile = async (file: File) => {
        setIsLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("Usuário não autenticado");

            // Optimizing Image (Client-side compression)
            const optimizedFile = await optimizeImage(file);

            const fileExtension = "webp"; // We are converting to webp
            const filePath = `${user.id}/${pathPrefix}/${crypto.randomUUID()}.${fileExtension}`;

            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(filePath, optimizedFile, { cacheControl: "3600", upsert: false });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
                .from(bucket)
                .getPublicUrl(filePath);

            onChange(publicUrl);
        } catch (error: any) {
            console.error("Upload error:", error);
            showUserError("Erro ao fazer upload da imagem", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            processFile(file);
        }
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleRemove = async (e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();
        onChange(null);
        // Note: We don't delete from storage immediately to avoid accidental data loss 
        // if user didn't mean to delete. Cleanup can be a background task.
    };

    return (
        <>
            {/* Global Blocking Loader */}
            {isLoading && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm cursor-wait">
                    <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 max-w-sm mx-4 text-center">
                        <div className="relative p-4 bg-pink-50 rounded-full mb-2">
                            <Loader2 className="h-8 w-8 text-pink-500 animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <Upload className="h-3 w-3 text-pink-500/50" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="font-bold text-xl text-gray-900">Processando Imagem</h3>
                            <p className="text-sm text-gray-500">Estamos otimizando e enviando sua foto.<br />Isso pode levar alguns segundos.</p>
                        </div>
                    </div>
                </div>
            )}

            <div className={`space-y-2 ${className}`}>
                {label && (
                    <label className="text-sm font-medium flex items-center gap-2 text-gray-700">
                        <ImagePlus className="h-4 w-4 text-pink-500" />
                        {label}
                    </label>
                )}

                <div
                    className={`
                        relative group border-2 border-dashed rounded-xl transition-all overflow-hidden
                        ${getAspectRatioClass()}
                        ${isDragging ? "border-pink-500 bg-pink-50" : "border-gray-300 hover:border-pink-300 hover:bg-gray-50"}
                        ${value ? "border-solid border-gray-200" : ""}
                    `}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => !isLoading && fileInputRef.current?.click()}
                >
                    {value ? (
                        <>
                            <img
                                src={value}
                                alt="Preview"
                                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                            />
                            {/* Overlay Gradient */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 md:opacity-0 opacity-100 flex flex-col justify-end p-3">
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (!isLoading) fileInputRef.current?.click();
                                        }}
                                        className="flex-1 bg-white/90 hover:bg-white text-gray-800 shadow-lg text-xs h-8"
                                        disabled={isLoading}
                                    >
                                        <Upload className="h-3 w-3 mr-1.5" />
                                        Trocar
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleRemove}
                                        className="bg-red-500/90 hover:bg-red-600 text-white shadow-lg h-8 w-8 p-0"
                                        disabled={isLoading}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-pink-50/30 transition-colors">
                            <div className="bg-pink-50 p-3 rounded-full mb-3 group-hover:scale-110 transition-transform duration-300">
                                <Upload className="h-6 w-6 text-pink-500" />
                            </div>
                            <p className="text-sm text-gray-700 font-medium group-hover:text-pink-600 transition-colors">
                                Clique para enviar
                            </p>
                            {helperText && (
                                <p className="text-xs text-gray-400 mt-1">{helperText}</p>
                            )}
                        </div>
                    )}

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                        disabled={isLoading}
                    />
                </div>
            </div>
        </>
    );
};

export default ImageUpload;

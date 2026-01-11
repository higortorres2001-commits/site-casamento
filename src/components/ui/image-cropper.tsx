"use client";

import React, { useState, useCallback } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import { Slider } from "@/components/ui/slider";

interface ImageCropperProps {
    imageSrc: string;
    aspectRatio: number;
    cropShape?: "round" | "rect";
    onCropComplete: (croppedBlob: Blob) => void;
    onCancel: () => void;
    isOpen: boolean;
}

const ImageCropper: React.FC<ImageCropperProps> = ({
    imageSrc,
    aspectRatio,
    cropShape = "rect",
    onCropComplete,
    onCancel,
    isOpen,
}) => {
    const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [rotation, setRotation] = useState(0);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    const onCropChange = useCallback((location: Point) => {
        setCrop(location);
    }, []);

    const onZoomChange = useCallback((newZoom: number) => {
        setZoom(newZoom);
    }, []);

    const onCropCompleteCallback = useCallback(
        (_croppedArea: Area, croppedAreaPixels: Area) => {
            setCroppedAreaPixels(croppedAreaPixels);
        },
        []
    );

    const createCroppedImage = async (): Promise<Blob> => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.crossOrigin = "anonymous";
            image.src = imageSrc;

            image.onload = () => {
                if (!croppedAreaPixels) {
                    reject(new Error("No crop area defined"));
                    return;
                }

                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");

                if (!ctx) {
                    reject(new Error("Failed to get canvas context"));
                    return;
                }

                // Set canvas size to the cropped area
                canvas.width = croppedAreaPixels.width;
                canvas.height = croppedAreaPixels.height;

                // Apply rotation if needed
                if (rotation !== 0) {
                    const rotRad = (rotation * Math.PI) / 180;
                    const tempCanvas = document.createElement("canvas");
                    const tempCtx = tempCanvas.getContext("2d");

                    if (!tempCtx) {
                        reject(new Error("Failed to get temp canvas context"));
                        return;
                    }

                    // Calculate new dimensions after rotation
                    const sin = Math.abs(Math.sin(rotRad));
                    const cos = Math.abs(Math.cos(rotRad));
                    const newWidth = image.width * cos + image.height * sin;
                    const newHeight = image.width * sin + image.height * cos;

                    tempCanvas.width = newWidth;
                    tempCanvas.height = newHeight;

                    tempCtx.translate(newWidth / 2, newHeight / 2);
                    tempCtx.rotate(rotRad);
                    tempCtx.drawImage(image, -image.width / 2, -image.height / 2);

                    ctx.drawImage(
                        tempCanvas,
                        croppedAreaPixels.x,
                        croppedAreaPixels.y,
                        croppedAreaPixels.width,
                        croppedAreaPixels.height,
                        0,
                        0,
                        croppedAreaPixels.width,
                        croppedAreaPixels.height
                    );
                } else {
                    ctx.drawImage(
                        image,
                        croppedAreaPixels.x,
                        croppedAreaPixels.y,
                        croppedAreaPixels.width,
                        croppedAreaPixels.height,
                        0,
                        0,
                        croppedAreaPixels.width,
                        croppedAreaPixels.height
                    );
                }

                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob);
                        } else {
                            reject(new Error("Canvas to blob conversion failed"));
                        }
                    },
                    "image/jpeg",
                    0.9
                );
            };

            image.onerror = () => reject(new Error("Failed to load image"));
        });
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            const croppedBlob = await createCroppedImage();
            onCropComplete(croppedBlob);
        } catch (error) {
            console.error("Crop failed:", error);
        } finally {
            setIsProcessing(false);
        }
    };

    const handleResetRotation = () => {
        setRotation(0);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-2xl p-0 max-h-[90vh] flex flex-col">
                <DialogHeader className="p-4 pb-0">
                    <DialogTitle className="text-center">Ajustar Imagem</DialogTitle>
                </DialogHeader>

                <div className="relative w-full h-[300px] sm:h-[400px] bg-black">
                    <Cropper
                        image={imageSrc}
                        crop={crop}
                        zoom={zoom}
                        rotation={rotation}
                        aspect={aspectRatio}
                        onCropChange={onCropChange}
                        onZoomChange={onZoomChange}
                        onCropComplete={onCropCompleteCallback}
                        showGrid
                        cropShape={cropShape}
                    />
                </div>

                <div className="p-4 space-y-4">
                    {/* Zoom Control */}
                    <div className="flex items-center gap-3">
                        <ZoomOut className="w-4 h-4 text-gray-500" />
                        <Slider
                            value={[zoom]}
                            onValueChange={(value) => setZoom(value[0])}
                            min={1}
                            max={3}
                            step={0.1}
                            className="flex-1"
                        />
                        <ZoomIn className="w-4 h-4 text-gray-500" />
                    </div>

                    {/* Rotation Control */}
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleResetRotation}
                            className="text-gray-500"
                        >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Rotação
                        </Button>
                        <Slider
                            value={[rotation]}
                            onValueChange={(value) => setRotation(value[0])}
                            min={-180}
                            max={180}
                            step={1}
                            className="flex-1"
                        />
                        <span className="text-xs text-gray-500 w-10 text-right">
                            {rotation}°
                        </span>
                    </div>
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 p-4 pt-0 justify-center">
                    <Button variant="outline" onClick={onCancel} disabled={isProcessing}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={isProcessing}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            "Confirmar Corte"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ImageCropper;

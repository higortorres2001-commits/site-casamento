import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
    Palette,
    ArrowLeft,
    PartyPopper,
    Sparkles,
    Check
} from "lucide-react";

export interface Step5Data {
    brand_color: string;
}

interface WizardStep5PersonalizationProps {
    initialData?: Partial<Step5Data>;
    onComplete: (data: Step5Data) => void;
    onBack: () => void;
    isSubmitting?: boolean;
}

const PRESET_COLORS = [
    { name: "Rosa Clássico", color: "#ec4899", gradient: "from-pink-400 to-pink-600" },
    { name: "Lavanda", color: "#a855f7", gradient: "from-purple-400 to-purple-600" },
    { name: "Azul Serenity", color: "#3b82f6", gradient: "from-blue-400 to-blue-600" },
    { name: "Verde Sage", color: "#22c55e", gradient: "from-green-400 to-green-600" },
    { name: "Terracota", color: "#ea580c", gradient: "from-orange-400 to-orange-600" },
    { name: "Dourado", color: "#eab308", gradient: "from-yellow-400 to-yellow-600" },
    { name: "Borgonha", color: "#be123c", gradient: "from-rose-600 to-rose-800" },
    { name: "Azul Marinho", color: "#1e40af", gradient: "from-blue-700 to-blue-900" },
];

const WizardStep5Personalization: React.FC<WizardStep5PersonalizationProps> = ({
    initialData,
    onComplete,
    onBack,
    isSubmitting = false,
}) => {
    const [selectedColor, setSelectedColor] = useState(
        initialData?.brand_color || "#ec4899"
    );

    const handleSubmit = () => {
        onComplete({ brand_color: selectedColor });
    };

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div
                        className="w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-300"
                        style={{ backgroundColor: selectedColor + "20" }}
                    >
                        <Palette
                            className="w-8 h-8 transition-colors duration-300"
                            style={{ color: selectedColor }}
                        />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    Toque final! 🎨
                </h2>
                <p className="text-gray-500 text-sm">
                    Escolha a cor tema da sua lista de presentes
                </p>
            </div>

            <div className="space-y-4">
                <Label className="text-gray-700 font-medium">Paleta de Cores</Label>
                <div className="grid grid-cols-4 gap-3">
                    {PRESET_COLORS.map((preset) => (
                        <button
                            key={preset.color}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setSelectedColor(preset.color)}
                            className={`
                                relative aspect-square rounded-xl transition-all duration-200
                                bg-gradient-to-br ${preset.gradient}
                                hover:scale-105 hover:shadow-lg
                                ${selectedColor === preset.color
                                    ? "ring-4 ring-offset-2 ring-gray-800 scale-105 shadow-lg"
                                    : "ring-1 ring-black/10"
                                }
                                ${isSubmitting ? "opacity-50 cursor-not-allowed hover:scale-100 hover:shadow-none" : ""}
                            `}
                            title={preset.name}
                        >
                            {selectedColor === preset.color && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <Check className="w-6 h-6 text-white drop-shadow-lg" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>

                {/* Custom color picker */}
                <div className="flex items-center gap-3 pt-2">
                    <Label className="text-sm text-gray-600">Cor personalizada:</Label>
                    <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => setSelectedColor(e.target.value)}
                        disabled={isSubmitting}
                        className={`w-10 h-10 rounded-lg cursor-pointer border-2 border-gray-200 ${isSubmitting ? "opacity-50 cursor-not-allowed" : ""}`}
                    />
                    <span className="text-sm font-mono text-gray-500">{selectedColor}</span>
                </div>

                {/* Preview */}
                <div
                    className="p-6 rounded-2xl transition-colors duration-300"
                    style={{ backgroundColor: selectedColor + "15" }}
                >
                    <p className="text-xs text-gray-500 mb-2">Prévia:</p>
                    <div className="flex items-center justify-center gap-3">
                        <div
                            className="px-6 py-3 rounded-full text-white font-semibold shadow-lg transition-colors duration-300"
                            style={{ backgroundColor: selectedColor }}
                        >
                            🎁 Ver Lista de Presentes
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 pt-4">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="h-12"
                    disabled={isSubmitting}
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>

                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="flex-1 h-16 text-xl font-bold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1"
                >
                    {isSubmitting ? (
                        <>
                            <Sparkles className="w-6 h-6 mr-2 animate-spin" />
                            Criando sua lista...
                        </>
                    ) : (
                        <>
                            <PartyPopper className="w-6 h-6 mr-2" />
                            Criar Minha Lista!
                        </>
                    )}
                </Button>
            </div>
        </div>
    );
};

export default WizardStep5Personalization;

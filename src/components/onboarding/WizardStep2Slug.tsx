import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    CheckCircle2,
    XCircle,
    Loader2,
    Link as LinkIcon,
    Sparkles,
    ArrowLeft,
    RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateCoupleSlug } from "@/utils/slug-generator";
import { useDebouncedCallback } from "use-debounce";

export interface Step2Data {
    slug: string;
}

interface WizardStep2SlugProps {
    brideName: string;
    groomName: string;
    initialSlug?: string;
    onNext: (data: Step2Data) => void;
    onBack: () => void;
}

const WizardStep2Slug: React.FC<WizardStep2SlugProps> = ({
    brideName,
    groomName,
    initialSlug,
    onNext,
    onBack,
}) => {
    const [slug, setSlug] = useState(initialSlug || "");
    const [isChecking, setIsChecking] = useState(false);
    const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [error, setError] = useState<string | null>(null);

    // Generate initial slug from names
    useEffect(() => {
        if (!initialSlug && brideName && groomName) {
            const generated = generateCoupleSlug(brideName, groomName);
            setSlug(generated);
        }
    }, [brideName, groomName, initialSlug]);

    // Debounced slug validation
    const checkSlugAvailability = useDebouncedCallback(async (slugToCheck: string) => {
        if (!slugToCheck || slugToCheck.length < 3) {
            setIsAvailable(null);
            return;
        }

        setIsChecking(true);
        setError(null);

        try {
            // Check directly in database for now
            // TODO: Move to Edge Function for better security
            const { data, error: dbError } = await supabase
                .from("wedding_lists")
                .select("slug")
                .eq("slug", slugToCheck)
                .maybeSingle();

            if (dbError) throw dbError;

            const available = !data;
            setIsAvailable(available);

            if (!available) {
                // Generate alternative suggestions
                const year = new Date().getFullYear();
                const brideFirst = brideName.split(" ")[0].toLowerCase();
                const groomFirst = groomName.split(" ")[0].toLowerCase();

                setSuggestions([
                    `${slugToCheck}-${year}`,
                    `casamento-${slugToCheck}`,
                    `${groomFirst}-e-${brideFirst}`,
                    `${slugToCheck}-wedding`,
                ].filter(s => s !== slugToCheck));
            } else {
                setSuggestions([]);
            }
        } catch (err) {
            console.error("Slug check error:", err);
            setError("Erro ao verificar disponibilidade");
            setIsAvailable(null);
        } finally {
            setIsChecking(false);
        }
    }, 500);

    // Check availability when slug changes
    useEffect(() => {
        if (slug) {
            checkSlugAvailability(slug);
        }
    }, [slug, checkSlugAvailability]);

    const handleSlugChange = (value: string) => {
        // Sanitize slug input
        const sanitized = value
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, "")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        setSlug(sanitized);
    };

    const handleSubmit = () => {
        if (isAvailable && slug) {
            onNext({ slug });
        }
    };

    const selectSuggestion = (suggested: string) => {
        setSlug(suggested);
    };

    const baseUrl = typeof window !== "undefined"
        ? `${window.location.origin}/lista/`
        : "meucasamento.com/lista/";

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 rounded-full flex items-center justify-center">
                        <LinkIcon className="w-8 h-8 text-blue-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    Escolha seu link único 🔗
                </h2>
                <p className="text-gray-500 text-sm">
                    Este será o endereço da sua lista de presentes
                </p>
            </div>

            <div className="space-y-4">
                <div>
                    <Label className="text-gray-700 font-medium">Seu link personalizado</Label>
                    <div className="mt-2 relative">
                        <div className="flex items-center border-2 rounded-lg overflow-hidden focus-within:border-blue-400 transition-colors bg-gray-50">
                            <span className="px-3 py-3 bg-gray-100 text-gray-500 text-sm border-r">
                                {baseUrl}
                            </span>
                            <Input
                                value={slug}
                                onChange={(e) => handleSlugChange(e.target.value)}
                                placeholder="nome-do-casal"
                                className="border-0 focus-visible:ring-0 text-lg font-medium"
                            />
                            <div className="pr-3">
                                {isChecking && <Loader2 className="w-5 h-5 animate-spin text-blue-500" />}
                                {!isChecking && isAvailable === true && (
                                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                                )}
                                {!isChecking && isAvailable === false && (
                                    <XCircle className="w-5 h-5 text-red-500" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Status message */}
                    <div className="mt-2 min-h-[24px]">
                        {isAvailable === true && (
                            <p className="text-green-600 text-sm flex items-center gap-1">
                                <CheckCircle2 className="w-4 h-4" />
                                Link disponível! Perfeito!
                            </p>
                        )}
                        {isAvailable === false && (
                            <p className="text-red-600 text-sm flex items-center gap-1">
                                <XCircle className="w-4 h-4" />
                                Este link já está em uso. Tente uma variação.
                            </p>
                        )}
                        {error && (
                            <p className="text-amber-600 text-sm">{error}</p>
                        )}
                    </div>
                </div>

                {/* Suggestions */}
                {suggestions.length > 0 && (
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                            <RefreshCw className="w-4 h-4" />
                            Sugestões disponíveis:
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {suggestions.map((s) => (
                                <Badge
                                    key={s}
                                    variant="outline"
                                    className="cursor-pointer hover:bg-blue-50 hover:border-blue-300 transition-colors px-3 py-1.5"
                                    onClick={() => selectSuggestion(s)}
                                >
                                    {s}
                                </Badge>
                            ))}
                        </div>
                    </div>
                )}

                {/* Preview */}
                <div className="p-4 bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl border border-pink-100">
                    <p className="text-xs text-gray-500 mb-1">Prévia do seu link:</p>
                    <p className="font-mono text-sm text-pink-600 break-all">
                        {baseUrl}<span className="font-bold">{slug || "..."}</span>
                    </p>
                </div>
            </div>

            <div className="flex gap-3">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onBack}
                    className="flex-1 h-12"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Voltar
                </Button>
                <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={!isAvailable || isChecking}
                    className="flex-[2] h-14 text-lg font-semibold bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
                >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Confirmar Link
                </Button>
            </div>
        </div>
    );
};

export default WizardStep2Slug;

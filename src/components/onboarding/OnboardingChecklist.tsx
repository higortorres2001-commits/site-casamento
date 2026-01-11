import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
    CheckCircle2,
    Circle,
    Gift,
    Users,
    Settings,
    Sparkles,
    ArrowRight
} from "lucide-react";
import type { WeddingList } from "@/types";

interface OnboardingChecklistProps {
    weddingList: WeddingList;
}

interface ChecklistItem {
    id: string;
    label: string;
    description: string;
    icon: React.ReactNode;
    isComplete: boolean;
    action: () => void;
    priority: "high" | "medium" | "low";
}

const OnboardingChecklist: React.FC<OnboardingChecklistProps> = ({ weddingList }) => {
    const navigate = useNavigate();

    const checklistItems: ChecklistItem[] = [
        {
            id: "gifts",
            label: "Adicionar presentes",
            description: "Cadastre seus presentes para os convidados escolherem",
            icon: <Gift className="w-5 h-5" />,
            isComplete: false, // Will be checked via props/context if needed
            action: () => navigate("/presentes"),
            priority: "high",
        },
        {
            id: "guests",
            label: "Importar convidados",
            description: "Adicione sua lista de convidados para enviar convites",
            icon: <Users className="w-5 h-5" />,
            isComplete: false,
            action: () => navigate("/convidados"),
            priority: "high",
        },
        {
            id: "ceremony",
            label: "Completar dados da cerimônia",
            description: "Adicione local e horário da cerimônia",
            icon: <Settings className="w-5 h-5" />,
            isComplete: !!(weddingList.ceremony_location_name && weddingList.ceremony_address),
            action: () => navigate("/minha-lista"),
            priority: "medium",
        },
        {
            id: "personalization",
            label: "Personalizar sua lista",
            description: "Adicione fotos e sua história como casal",
            icon: <Sparkles className="w-5 h-5" />,
            isComplete: !!(weddingList.couple_profile_image || weddingList.cover_image_mobile),
            action: () => navigate("/minha-lista"),
            priority: "low",
        },
    ];

    const completedCount = checklistItems.filter((item) => item.isComplete).length;
    const progress = (completedCount / checklistItems.length) * 100;

    // If all items are complete, don't show the checklist
    if (completedCount === checklistItems.length) {
        return null;
    }

    return (
        <Card className="border-2 border-pink-100 bg-gradient-to-br from-pink-50 to-white shadow-lg">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Sparkles className="w-5 h-5 text-pink-500" />
                            Complete sua lista
                        </CardTitle>
                        <p className="text-sm text-gray-500 mt-1">
                            {completedCount} de {checklistItems.length} etapas concluídas
                        </p>
                    </div>
                    <div className="text-2xl font-bold text-pink-500">
                        {Math.round(progress)}%
                    </div>
                </div>
                <Progress value={progress} className="h-2 mt-3" />
            </CardHeader>
            <CardContent className="space-y-3">
                {checklistItems
                    .filter((item) => !item.isComplete)
                    .slice(0, 3) // Show max 3 pending items
                    .map((item) => (
                        <div
                            key={item.id}
                            className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-100 hover:border-pink-200 hover:shadow-sm transition-all cursor-pointer group"
                            onClick={item.action}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`
                                    p-2 rounded-full transition-colors
                                    ${item.priority === "high"
                                        ? "bg-pink-100 text-pink-600"
                                        : item.priority === "medium"
                                            ? "bg-blue-100 text-blue-600"
                                            : "bg-gray-100 text-gray-600"
                                    }
                                `}>
                                    {item.icon}
                                </div>
                                <div>
                                    <p className="font-medium text-gray-800 group-hover:text-pink-600 transition-colors">
                                        {item.label}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {item.description}
                                    </p>
                                </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-pink-500 group-hover:translate-x-1 transition-all" />
                        </div>
                    ))}
            </CardContent>
        </Card>
    );
};

export default OnboardingChecklist;

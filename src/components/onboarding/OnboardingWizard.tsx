import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showUserError } from "@/utils/toast";
import { generateCoupleSlug } from "@/utils/slug-generator";
import { Heart, Check } from "lucide-react";

import WizardStep1Names, { Step1Data } from "./WizardStep1Names";
import WizardStep2Slug, { Step2Data } from "./WizardStep2Slug";
import WizardStep3Ceremony, { Step3Data } from "./WizardStep3Ceremony";
import WizardStep4Party, { Step4Data } from "./WizardStep4Party";
import WizardStep5Personalization, { Step5Data } from "./WizardStep5Personalization";

interface OnboardingWizardProps {
    userId: string;
    onComplete?: (weddingListId: string) => void;
}

interface WizardFormData {
    step1?: Step1Data;
    step2?: Step2Data;
    step3?: Step3Data;
    step4?: Step4Data;
    step5?: Step5Data;
}

const STEPS = [
    { id: 1, label: "Noivos", icon: "💒" },
    { id: 2, label: "Link", icon: "🔗" },
    { id: 3, label: "Cerimônia", icon: "⛪" },
    { id: 4, label: "Festa", icon: "🎉" },
    { id: 5, label: "Cor", icon: "🎨" },
];

const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ userId, onComplete }) => {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState<WizardFormData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);

    const progress = (currentStep / STEPS.length) * 100;

    // Step 1: Names & Date
    const handleStep1Next = (data: Step1Data) => {
        setFormData((prev) => ({ ...prev, step1: data }));
        setCurrentStep(2);
    };

    // Step 2: Slug
    const handleStep2Next = (data: Step2Data) => {
        setFormData((prev) => ({ ...prev, step2: data }));
        setCurrentStep(3);
    };

    // Step 3: Ceremony
    const handleStep3Next = (data: Step3Data) => {
        setFormData((prev) => ({ ...prev, step3: data }));
        setCurrentStep(4);
    };

    const handleStep3Skip = () => {
        setFormData((prev) => ({ ...prev, step3: {} }));
        setCurrentStep(4);
    };

    // Step 4: Party
    const handleStep4Next = (data: Step4Data) => {
        setFormData((prev) => ({ ...prev, step4: data }));
        setCurrentStep(5);
    };

    const handleStep4Skip = () => {
        setFormData((prev) => ({ ...prev, step4: { has_party: false, same_location: false } }));
        setCurrentStep(5);
    };

    // Step 5: Personalization & Submit
    const handleStep5Complete = async (data: Step5Data) => {
        setIsSubmitting(true);

        try {
            const finalData = { ...formData, step5: data };

            // Ensure profile exists (FK requirement for wedding_lists)
            const { error: profileError } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    full_name: `${finalData.step1!.bride_name} & ${finalData.step1!.groom_name}`,
                }, { onConflict: 'id' });

            if (profileError) {
                console.error("Profile upsert error:", profileError);
                // Continue anyway - profile might already exist
            }

            // Create the wedding list
            const { data: newList, error } = await supabase
                .from("wedding_lists")
                .insert({
                    user_id: userId,
                    bride_name: finalData.step1!.bride_name,
                    groom_name: finalData.step1!.groom_name,
                    wedding_date: finalData.step1!.wedding_date,
                    slug: finalData.step2!.slug,
                    ceremony_location_name: finalData.step3?.ceremony_location_name || null,
                    ceremony_address: finalData.step3?.ceremony_address || null,
                    ceremony_time: finalData.step3?.ceremony_time || null,
                    has_party: finalData.step4?.has_party ?? false,
                    party_location_name: finalData.step4?.party_location_name || null,
                    party_address: finalData.step4?.party_address || null,
                    party_time: finalData.step4?.party_time || null,
                    brand_color: finalData.step5!.brand_color,
                    is_public: true,
                })
                .select()
                .single();

            if (error) throw error;

            // 🎉 Success!
            setShowConfetti(true);
            showSuccess("Sua lista foi criada com sucesso! 🎉");

            // Short delay for confetti animation
            setTimeout(() => {
                if (onComplete) {
                    onComplete(newList.id);
                } else {
                    navigate("/dashboard");
                }
            }, 2000);
        } catch (err: any) {
            console.error("Error creating wedding list:", err);
            console.error("Error details:", JSON.stringify(err, null, 2));
            console.error("Final data being inserted:", JSON.stringify(formData, null, 2));
            showUserError(`Erro ao criar lista: ${err?.message || 'Tente novamente'}`, err);
            setIsSubmitting(false);
        }
    };

    // Navigation
    const goBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-8 px-4">
            {/* Confetti overlay */}
            {showConfetti && (
                <div className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center">
                    <div className="text-8xl animate-bounce">🎉</div>
                </div>
            )}

            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="bg-pink-100 p-4 rounded-full shadow-lg">
                            <Heart className="w-10 h-10 text-pink-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        Crie sua lista de presentes
                    </h1>
                    <p className="text-gray-500">
                        Em apenas 5 passos rápidos
                    </p>
                </div>

                {/* Progress */}
                <div className="mb-6">
                    <div className="flex justify-between mb-2">
                        {STEPS.map((step) => (
                            <div
                                key={step.id}
                                className={`flex flex-col items-center transition-all ${currentStep >= step.id ? "opacity-100" : "opacity-40"
                                    }`}
                            >
                                <div
                                    className={`w-10 h-10 rounded-full flex items-center justify-center text-lg transition-all ${currentStep > step.id
                                        ? "bg-green-500 text-white"
                                        : currentStep === step.id
                                            ? "bg-pink-500 text-white shadow-lg scale-110"
                                            : "bg-gray-200"
                                        }`}
                                >
                                    {currentStep > step.id ? (
                                        <Check className="w-5 h-5" />
                                    ) : (
                                        step.icon
                                    )}
                                </div>
                                <span className="text-xs mt-1 font-medium text-gray-600">
                                    {step.label}
                                </span>
                            </div>
                        ))}
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* Card */}
                <Card className="shadow-xl border-0 overflow-hidden">
                    <CardContent className="p-6 md:p-8">
                        {currentStep === 1 && (
                            <WizardStep1Names
                                initialData={formData.step1}
                                onNext={handleStep1Next}
                            />
                        )}

                        {currentStep === 2 && (
                            <WizardStep2Slug
                                brideName={formData.step1?.bride_name || ""}
                                groomName={formData.step1?.groom_name || ""}
                                initialSlug={formData.step2?.slug}
                                onNext={handleStep2Next}
                                onBack={goBack}
                            />
                        )}

                        {currentStep === 3 && (
                            <WizardStep3Ceremony
                                initialData={formData.step3}
                                onNext={handleStep3Next}
                                onBack={goBack}
                                onSkip={handleStep3Skip}
                            />
                        )}

                        {currentStep === 4 && (
                            <WizardStep4Party
                                initialData={formData.step4}
                                ceremonyData={formData.step3}
                                onNext={handleStep4Next}
                                onBack={goBack}
                                onSkip={handleStep4Skip}
                            />
                        )}

                        {currentStep === 5 && (
                            <WizardStep5Personalization
                                initialData={formData.step5}
                                onComplete={handleStep5Complete}
                                onBack={goBack}
                                isSubmitting={isSubmitting}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-6">
                    Você pode editar tudo isso depois nas configurações
                </p>
            </div>
        </div>
    );
};

export default OnboardingWizard;

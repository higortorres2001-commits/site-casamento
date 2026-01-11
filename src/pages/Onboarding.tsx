import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { showSuccess, showUserError } from "@/utils/toast";
import Brand from "@/components/Brand";

import WizardStep0Auth from "@/components/onboarding/WizardStep0Auth";
import WizardStep1Names, { Step1Data } from "@/components/onboarding/WizardStep1Names";
import WizardStep2Slug, { Step2Data } from "@/components/onboarding/WizardStep2Slug";
import WizardStep3Ceremony, { Step3Data } from "@/components/onboarding/WizardStep3Ceremony";
import WizardStep4Party, { Step4Data } from "@/components/onboarding/WizardStep4Party";
import WizardStep5Personalization, { Step5Data } from "@/components/onboarding/WizardStep5Personalization";

interface WizardFormData {
    step1?: Step1Data;
    step2?: Step2Data;
    step3?: Step3Data;
    step4?: Step4Data;
    step5?: Step5Data;
}

const STEPS_AUTH = [
    { id: 0, label: "Conta", icon: "👤" },
    { id: 1, label: "Casal", icon: "💒" },
    { id: 2, label: "Link", icon: "🔗" },
    { id: 3, label: "Cerimônia", icon: "⛪" },
    { id: 4, label: "Festa", icon: "🎉" },
    { id: 5, label: "Cor", icon: "🎨" },
];

const STEPS_NO_AUTH = [
    { id: 1, label: "Casal", icon: "💒" },
    { id: 2, label: "Link", icon: "🔗" },
    { id: 3, label: "Cerimônia", icon: "⛪" },
    { id: 4, label: "Festa", icon: "🎉" },
    { id: 5, label: "Cor", icon: "🎨" },
];

const Onboarding = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [hasExistingList, setHasExistingList] = useState(false);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [formData, setFormData] = useState<WizardFormData>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const navigate = useNavigate();

    const STEPS = isAuthenticated ? STEPS_NO_AUTH : STEPS_AUTH;
    const totalSteps = STEPS.length;
    const progress = ((currentStep + 1) / totalSteps) * 100;

    useEffect(() => {
        const checkUser = async () => {
            try {
                const { data: { user } } = await supabase.auth.getUser();

                if (user) {
                    setUserId(user.id);
                    setIsAuthenticated(true);
                    setCurrentStep(1); // Skip auth step

                    // Check if user already has a wedding list
                    const { data: existingList } = await supabase
                        .from("wedding_lists")
                        .select("id")
                        .eq("user_id", user.id)
                        .maybeSingle();

                    if (existingList) {
                        setHasExistingList(true);
                        navigate("/dashboard");
                        return;
                    }
                } else {
                    // Not authenticated, start at step 0
                    setIsAuthenticated(false);
                    setCurrentStep(0);
                }

                setLoading(false);
            } catch (error) {
                console.error("Auth error:", error);
                setLoading(false);
            }
        };

        checkUser();
    }, [navigate]);

    // Step 0: Auth (only for unauthenticated users)
    const handleStep0Next = (newUserId: string, fullName: string, email: string) => {
        setUserId(newUserId);
        setIsAuthenticated(true);
        setCurrentStep(1);
    };

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
        if (!userId) {
            showUserError("Erro: usuário não encontrado. Tente novamente.", null);
            return;
        }

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

            setTimeout(() => {
                navigate("/dashboard");
            }, 4000);
        } catch (err: any) {
            console.error("Error creating wedding list:", err);
            showUserError(`Erro ao criar lista: ${err?.message || 'Tente novamente'}`, err);
            setIsSubmitting(false);
        }
    };

    // Navigation
    const goBack = () => {
        const minStep = isAuthenticated ? 1 : 0;
        if (currentStep > minStep) {
            setCurrentStep(currentStep - 1);
        }
    };

    if (loading || hasExistingList) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-pink-500 animate-spin mx-auto" />
                    <p className="mt-4 text-gray-500">Carregando...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-8 px-4 relative overflow-hidden">
            {/* Confetti overlay */}
            {showConfetti && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm transition-opacity duration-500">
                    {/* Main Emoji */}
                    <div className="relative z-10 animate-bounce">
                        <div className="text-9xl drop-shadow-2xl filter brightness-110">🎉</div>
                    </div>

                    {/* Floating Confettis */}
                    <div className="absolute inset-0 overflow-hidden pointer-events-none">
                        {[...Array(20)].map((_, i) => (
                            <div
                                key={i}
                                className="absolute text-4xl animate-pulse"
                                style={{
                                    left: `${Math.random() * 100}%`,
                                    top: `${Math.random() * 100}%`,
                                    animationDelay: `${Math.random() * 2}s`,
                                    animationDuration: `${1 + Math.random() * 2}s`,
                                    opacity: 0.7
                                }}
                            >
                                {['✨', '🎊', '🎈', '🎆', '🥳'][Math.floor(Math.random() * 5)]}
                            </div>
                        ))}
                    </div>

                    <div className="absolute bottom-20 text-white text-xl font-bold animate-pulse">
                        Criando seu espaço... ✨
                    </div>
                </div>
            )}

            <div className="max-w-lg mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <Brand size="xl" />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Crie sua lista de presentes
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Em apenas {totalSteps} passos rápidos
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
                        {currentStep === 0 && !isAuthenticated && (
                            <WizardStep0Auth onNext={handleStep0Next} />
                        )}

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

export default Onboarding;

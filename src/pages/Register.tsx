import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Heart } from "lucide-react";
import RegistrationStep1 from "@/components/registration/RegistrationStep1";
import RegistrationStep2 from "@/components/registration/RegistrationStep2";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { AUTH_MESSAGES } from "@/constants/messages";
import { cleanCPF } from "@/utils/cpf-validator";
import { cleanPhoneNumber } from "@/utils/phone-formatter";

type Step1Data = {
    full_name: string;
    whatsapp: string;
    cpf: string;
    birth_date: string;
    email: string;
    password: string;
    confirmPassword: string;
};

type Step2Data = {
    state: string;
    city: string;
    address: string;
    complement?: string;
};

const Register = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [step1Data, setStep1Data] = useState<Step1Data | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleStep1Next = async (data: Step1Data) => {
        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
            });

            if (authError) {
                showUserError(AUTH_MESSAGES.error.REGISTER_FAILED, authError);
                return;
            }

            if (!authData.user) {
                showError(AUTH_MESSAGES.error.REGISTER_FAILED);
                return;
            }

            // Store user ID for Step 2
            const newUserId = authData.user.id;

            // Create profile with step 1 data
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                    id: newUserId,
                    full_name: data.full_name,
                    whatsapp: cleanPhoneNumber(data.whatsapp),
                    cpf: cleanCPF(data.cpf),
                    birth_date: data.birth_date,
                    email: data.email,
                    registration_step: 1,
                });

            if (profileError) {
                showUserError(AUTH_MESSAGES.error.PROFILE_SAVE_FAILED, profileError);
                return;
            }

            // Save data and user ID, move to step 2
            setStep1Data(data);
            setUserId(newUserId);
            setCurrentStep(2);
            showSuccess(AUTH_MESSAGES.success.REGISTER_STEP1);
        } catch (error: any) {
            showUserError(AUTH_MESSAGES.error.REGISTER_FAILED, error);
        }
    };

    const handleStep2Submit = async (data: Step2Data) => {
        if (!step1Data || !userId) {
            showError("Erro: dados da etapa 1 não encontrados. Tente novamente.");
            setCurrentStep(1);
            return;
        }

        try {
            // Update profile with step 2 data using stored userId
            const { error: updateError } = await supabase
                .from("profiles")
                .update({
                    state: data.state,
                    city: data.city,
                    address: data.address,
                    complement: data.complement || null,
                    registration_step: 2,
                })
                .eq("id", userId);

            if (updateError) {
                showUserError(AUTH_MESSAGES.error.PROFILE_SAVE_FAILED, updateError);
                return;
            }

            showSuccess(AUTH_MESSAGES.success.REGISTER);
            navigate("/onboarding");
        } catch (error: any) {
            showUserError(AUTH_MESSAGES.error.REGISTER_FAILED, error);
        }
    };

    const handleStep2Back = () => {
        setCurrentStep(1);
    };

    const progress = (currentStep / 2) * 100;

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="flex justify-center mb-4">
                        <div className="bg-pink-100 p-3 rounded-full">
                            <Heart className="h-8 w-8 text-pink-500" />
                        </div>
                    </div>
                    <CardTitle className="text-2xl font-bold text-gray-800">
                        Criar Lista de Presentes
                    </CardTitle>
                    <CardDescription>
                        Etapa {currentStep} de 2
                    </CardDescription>
                    <Progress value={progress} className="mt-4" />
                </CardHeader>
                <CardContent>
                    {currentStep === 1 && (
                        <RegistrationStep1
                            onNext={handleStep1Next}
                            initialData={step1Data || undefined}
                        />
                    )}
                    {currentStep === 2 && (
                        <RegistrationStep2
                            onSubmit={handleStep2Submit}
                            onBack={handleStep2Back}
                        />
                    )}

                    <div className="mt-6 text-center text-sm text-gray-600">
                        Já tem uma conta?{" "}
                        <a
                            href="/login"
                            className="text-pink-500 hover:text-pink-600 font-medium"
                        >
                            Fazer login
                        </a>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Register;

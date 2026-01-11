import React, { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { User, Mail, Lock, Eye, EyeOff, Sparkles, Loader2, KeyRound, Timer, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showUserError, showError } from "@/utils/toast";
import { AUTH_MESSAGES } from "@/constants/messages";

const step0Schema = z.object({
    full_name: z.string().min(2, "Nome completo é obrigatório"),
    email: z.string().email("Email inválido"),
    password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
    confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não conferem",
    path: ["confirmPassword"],
});

export type Step0Data = z.infer<typeof step0Schema>;

interface WizardStep0AuthProps {
    onNext: (userId: string, fullName: string, email: string) => void;
}

const WizardStep0Auth: React.FC<WizardStep0AuthProps> = ({ onNext }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);

    // OTP States
    const [isOtpMode, setIsOtpMode] = useState(false);
    const [otpEmail, setOtpEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", "", "", "", ""]);
    const [timeLeft, setTimeLeft] = useState(35);
    const [canResend, setCanResend] = useState(false);

    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    const form = useForm<Step0Data>({
        resolver: zodResolver(step0Schema),
        defaultValues: {
            full_name: "",
            email: "",
            password: "",
            confirmPassword: "",
        },
    });

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isOtpMode && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timeLeft === 0) {
            setCanResend(true);
        }
        return () => clearInterval(interval);
    }, [isOtpMode, timeLeft]);

    const handleOtpChange = (index: number, value: string) => {
        if (!/^\d*$/.test(value)) return;

        const newOtp = [...otp];
        newOtp[index] = value;
        setOtp(newOtp);

        if (value !== "" && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }

        const otpCode = newOtp.join("");
        if (otpCode.length === 6) {
            handleVerifyOtp(otpCode);
        }
    };

    const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 6);
        if (/^\d+$/.test(pastedData)) {
            const newOtp = [...otp];
            pastedData.split("").forEach((char, index) => {
                if (index < 6) newOtp[index] = char;
            });
            setOtp(newOtp);
            if (pastedData.length === 6) {
                handleVerifyOtp(pastedData);
            }
        }
    };

    const handleVerifyOtp = async (code: string) => {
        setIsLoading(true);
        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: otpEmail,
                token: code,
                type: 'email'
            });

            if (error) throw error;

            if (data.user) {
                // Fetch existing profile
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("full_name")
                    .eq("id", data.user.id)
                    .single();

                showSuccess("Login realizado com sucesso! 🎉");
                onNext(data.user.id, profile?.full_name || form.getValues("full_name"), otpEmail);
            }
        } catch (error: any) {
            console.error("OTP Error:", error);
            showUserError("Código inválido ou expirado.", error);
            setOtp(["", "", "", "", "", ""]);
            inputRefs.current[0]?.focus();
        } finally {
            setIsLoading(false);
        }
    };

    const handleResendOtp = async () => {
        setOtp(["", "", "", "", "", ""]);
        setTimeLeft(35);
        setCanResend(false);

        const { error } = await supabase.auth.signInWithOtp({
            email: otpEmail,
        });

        if (error) {
            showError("Erro ao reenviar código: " + error.message);
        } else {
            showSuccess("Código reenviado!");
        }
    };

    const handleSubmit = async (data: Step0Data) => {
        setIsLoading(true);

        try {
            // Try to sign up first
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: data.email,
                password: data.password,
            });

            if (authError) {
                // Check if user already exists
                if (authError.message.includes("User already registered") || authError.status === 400) {
                    // Switch to OTP mode
                    setOtpEmail(data.email);

                    const { error: otpError } = await supabase.auth.signInWithOtp({
                        email: data.email,
                    });

                    if (otpError) {
                        showUserError("Erro ao enviar código de verificação.", otpError);
                        return;
                    }

                    showSuccess("E-mail já cadastrado. Enviamos um código para você entrar! 📧");
                    setIsOtpMode(true);
                    return;
                }

                showUserError(AUTH_MESSAGES.error.REGISTER_FAILED, authError);
                return;
            }

            if (!authData.user) {
                showUserError("Erro ao criar conta. Tente novamente.", null);
                return;
            }

            // Success flow for new user
            const userId = authData.user.id;
            const { error: profileError } = await supabase
                .from("profiles")
                .upsert({
                    id: userId,
                    full_name: data.full_name,
                    email: data.email,
                }, { onConflict: 'id' });

            if (profileError) console.error("Profile creation error:", profileError);

            showSuccess("Conta criada! Verifique seu email para confirmar. 📧");
            onNext(userId, data.full_name, data.email);
        } catch (err: any) {
            console.error("Auth error:", err);
            showUserError(AUTH_MESSAGES.error.REGISTER_FAILED, err);
        } finally {
            setIsLoading(false);
        }
    };

    if (isOtpMode) {
        return (
            <div className="space-y-6">
                <div className="text-center space-y-2">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                            <KeyRound className="w-8 h-8 text-purple-500" />
                        </div>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-800">
                        Código de Acesso
                    </h2>
                    <p className="text-gray-500 text-sm">
                        Digite o código enviado para <br />
                        <span className="font-medium text-gray-700">{otpEmail}</span>
                    </p>
                </div>

                <div className="flex justify-center gap-2 my-6">
                    {otp.map((digit, index) => (
                        index < 6 && (
                            <Input
                                key={index}
                                ref={(el) => (inputRefs.current[index] = el)}
                                type="text"
                                inputMode="numeric"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleKeyDown(index, e)}
                                onPaste={handlePaste}
                                disabled={isLoading}
                                className="w-12 h-14 text-center text-2xl font-bold border-2 focus:border-purple-500 focus:ring-purple-200 transition-all rounded-xl"
                            />
                        )
                    ))}
                </div>

                <Button
                    onClick={() => handleVerifyOtp(otp.join(""))}
                    disabled={isLoading || otp.join("").length !== 6}
                    className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                            Verificando...
                        </>
                    ) : (
                        "Entrar"
                    )}
                </Button>

                <div className="flex flex-col items-center gap-3 pt-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Timer className="w-4 h-4" />
                        {canResend ? (
                            <button
                                onClick={handleResendOtp}
                                className="text-purple-600 font-medium hover:underline"
                            >
                                Reenviar código
                            </button>
                        ) : (
                            <span>Reenviar em {timeLeft}s</span>
                        )}
                    </div>

                    <button
                        onClick={() => setIsOtpMode(false)}
                        className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
                    >
                        <ArrowLeft className="w-3 h-3" />
                        Voltar para cadastro
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-rose-100 to-rose-200 rounded-full flex items-center justify-center">
                        <User className="w-8 h-8 text-rose-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    Crie sua conta 🎉
                </h2>
                <p className="text-gray-500 text-sm">
                    Primeiro, vamos criar seu acesso ao DuetLove
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <FormField
                        control={form.control}
                        name="full_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <User className="w-4 h-4 text-rose-500" /> Seu Nome Completo
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex: Maria Silva"
                                        {...field}
                                        disabled={isLoading}
                                        className="h-12 border-2 focus:border-rose-400"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Mail className="w-4 h-4 text-rose-500" /> Email
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="email"
                                        placeholder="seu@email.com"
                                        {...field}
                                        disabled={isLoading}
                                        className="h-12 border-2 focus:border-rose-400"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Lock className="w-4 h-4 text-rose-500" /> Senha
                                </FormLabel>
                                <FormControl>
                                    <div className="relative">
                                        <Input
                                            type={showPassword ? "text" : "password"}
                                            placeholder="Mínimo 6 caracteres"
                                            {...field}
                                            disabled={isLoading}
                                            className="h-12 border-2 focus:border-rose-400 pr-10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                        >
                                            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                        </button>
                                    </div>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="confirmPassword"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Lock className="w-4 h-4 text-rose-500" /> Confirmar Senha
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="Digite a senha novamente"
                                        {...field}
                                        disabled={isLoading}
                                        className="h-12 border-2 focus:border-rose-400"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        disabled={isLoading}
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-rose-500 to-pink-600 hover:from-rose-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                Criando conta...
                            </>
                        ) : (
                            <>
                                <Sparkles className="w-5 h-5 mr-2" />
                                Criar Conta e Continuar
                            </>
                        )}
                    </Button>

                    <p className="text-center text-xs text-gray-400">
                        Já tem uma conta?{" "}
                        <a href="/login" className="text-pink-500 hover:text-pink-600 font-medium">
                            Fazer login
                        </a>
                    </p>
                </form>
            </Form>
        </div>
    );
};

export default WizardStep0Auth;

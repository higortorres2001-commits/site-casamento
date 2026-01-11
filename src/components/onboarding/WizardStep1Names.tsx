import React from "react";
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
import { Calendar, Sparkles } from "lucide-react";
import Brand from "@/components/Brand";

const step1Schema = z.object({
    bride_name: z.string().min(2, "Seu nome é obrigatório"),
    groom_name: z.string().min(2, "Nome do seu amor é obrigatório"),
    wedding_date: z.string().min(1, "Data do casamento é obrigatória"),
});

export type Step1Data = z.infer<typeof step1Schema>;

interface WizardStep1NamesProps {
    initialData?: Partial<Step1Data>;
    onNext: (data: Step1Data) => void;
}

const WizardStep1Names: React.FC<WizardStep1NamesProps> = ({ initialData, onNext }) => {
    const form = useForm<Step1Data>({
        resolver: zodResolver(step1Schema),
        defaultValues: {
            bride_name: initialData?.bride_name || "",
            groom_name: initialData?.groom_name || "",
            wedding_date: initialData?.wedding_date || "",
        },
    });

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <Brand size="lg" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    Vamos começar! 💒
                </h2>
                <p className="text-gray-500 text-sm">
                    Conte-nos sobre vocês e a data especial
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="bride_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <span className="text-lg">💕</span> Seu Nome
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex: Maria Silva"
                                        {...field}
                                        className="h-12 text-lg border-2 focus:border-pink-400 focus:ring-pink-200 transition-all"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="groom_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <span className="text-lg">❤️</span> Nome do Seu Amor
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex: João Santos"
                                        {...field}
                                        className="h-12 text-lg border-2 focus:border-pink-400 focus:ring-pink-200 transition-all"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="wedding_date"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Calendar className="w-5 h-5 text-pink-500" /> Data do Casamento
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="date"
                                        {...field}
                                        className="h-12 text-lg border-2 focus:border-pink-400 focus:ring-pink-200 transition-all"
                                        min={new Date().toISOString().split("T")[0]}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <Button
                        type="submit"
                        className="w-full h-14 text-lg font-semibold bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-600 hover:to-pink-700 text-white shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5"
                    >
                        <Sparkles className="w-5 h-5 mr-2" />
                        Continuar
                    </Button>
                </form>
            </Form>
        </div>
    );
};

export default WizardStep1Names;

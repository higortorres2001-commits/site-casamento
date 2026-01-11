import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Church, MapPin, Clock, ArrowLeft, Sparkles, SkipForward } from "lucide-react";

const step3Schema = z.object({
    ceremony_location_name: z.string().optional(),
    ceremony_address: z.string().optional(),
    ceremony_time: z.string().optional(),
});

export type Step3Data = z.infer<typeof step3Schema>;

interface WizardStep3CeremonyProps {
    initialData?: Partial<Step3Data>;
    onNext: (data: Step3Data) => void;
    onBack: () => void;
    onSkip: () => void;
}

const WizardStep3Ceremony: React.FC<WizardStep3CeremonyProps> = ({
    initialData,
    onNext,
    onBack,
    onSkip,
}) => {
    const form = useForm<Step3Data>({
        resolver: zodResolver(step3Schema),
        defaultValues: {
            ceremony_location_name: initialData?.ceremony_location_name || "",
            ceremony_address: initialData?.ceremony_address || "",
            ceremony_time: initialData?.ceremony_time || "",
        },
    });

    const hasData = form.watch("ceremony_location_name") || form.watch("ceremony_address");

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-full flex items-center justify-center">
                        <Church className="w-8 h-8 text-purple-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    Onde será a cerimônia? 💒
                </h2>
                <p className="text-gray-500 text-sm">
                    Ajude seus convidados a encontrar o local
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="ceremony_location_name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Church className="w-4 h-4 text-purple-500" /> Nome do Local
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="Ex: Igreja Nossa Senhora das Graças"
                                        {...field}
                                        className="h-12 border-2 focus:border-purple-400"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="ceremony_address"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <MapPin className="w-4 h-4 text-purple-500" /> Endereço
                                </FormLabel>
                                <FormControl>
                                    <Textarea
                                        placeholder="Rua das Flores, 123 - Centro, São Paulo - SP"
                                        rows={2}
                                        {...field}
                                        className="resize-none border-2 focus:border-purple-400"
                                    />
                                </FormControl>
                                <FormDescription className="text-xs">
                                    Inclua o endereço completo para facilitar a navegação
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="ceremony_time"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                    <Clock className="w-4 h-4 text-purple-500" /> Horário
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        type="time"
                                        {...field}
                                        className="h-12 border-2 focus:border-purple-400 w-40"
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <div className="flex gap-3 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onBack}
                            className="h-12"
                        >
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Voltar
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onSkip}
                            className="h-12 text-gray-500 hover:text-gray-700"
                        >
                            <SkipForward className="w-4 h-4 mr-2" />
                            Pular
                        </Button>

                        <Button
                            type="submit"
                            className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-lg"
                        >
                            <Sparkles className="w-5 h-5 mr-2" />
                            Continuar
                        </Button>
                    </div>
                </form>
            </Form>
        </div>
    );
};

export default WizardStep3Ceremony;

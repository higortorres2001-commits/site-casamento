import React, { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { PartyPopper, MapPin, Clock, ArrowLeft, Sparkles, SkipForward, Copy } from "lucide-react";

const step4Schema = z.object({
    has_party: z.boolean().default(false),
    same_location: z.boolean().default(true),
    party_location_name: z.string().optional(),
    party_address: z.string().optional(),
    party_time: z.string().optional(),
});

export type Step4Data = z.infer<typeof step4Schema>;

interface WizardStep4PartyProps {
    initialData?: Partial<Step4Data>;
    ceremonyData?: {
        ceremony_location_name?: string;
        ceremony_address?: string;
    };
    onNext: (data: Step4Data) => void;
    onBack: () => void;
    onSkip: () => void;
}

const WizardStep4Party: React.FC<WizardStep4PartyProps> = ({
    initialData,
    ceremonyData,
    onNext,
    onBack,
    onSkip,
}) => {
    const form = useForm<Step4Data>({
        resolver: zodResolver(step4Schema),
        defaultValues: {
            has_party: initialData?.has_party ?? true,
            same_location: initialData?.same_location ?? true,
            party_location_name: initialData?.party_location_name || "",
            party_address: initialData?.party_address || "",
            party_time: initialData?.party_time || "",
        },
    });

    const hasParty = form.watch("has_party");
    const sameLocation = form.watch("same_location");

    // Copy ceremony data when same_location is toggled
    useEffect(() => {
        if (sameLocation && ceremonyData) {
            form.setValue("party_location_name", ceremonyData.ceremony_location_name || "");
            form.setValue("party_address", ceremonyData.ceremony_address || "");
        }
    }, [sameLocation, ceremonyData, form]);

    return (
        <div className="space-y-6">
            <div className="text-center space-y-2">
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-orange-200 rounded-full flex items-center justify-center">
                        <PartyPopper className="w-8 h-8 text-orange-500" />
                    </div>
                </div>
                <h2 className="text-2xl font-bold text-gray-800">
                    E a festa? 🎉
                </h2>
                <p className="text-gray-500 text-sm">
                    Essa etapa é <span className="font-medium text-orange-600">opcional</span>
                </p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onNext)} className="space-y-5">
                    <FormField
                        control={form.control}
                        name="has_party"
                        render={({ field }) => (
                            <FormItem className="flex items-center justify-between p-4 bg-orange-50 rounded-xl border border-orange-100">
                                <div>
                                    <FormLabel className="text-base font-medium text-gray-800">
                                        Teremos festa de recepção
                                    </FormLabel>
                                    <FormDescription className="text-xs">
                                        Ative se terá festa após a cerimônia
                                    </FormDescription>
                                </div>
                                <FormControl>
                                    <Switch
                                        checked={field.value}
                                        onCheckedChange={field.onChange}
                                        className="data-[state=checked]:bg-orange-500"
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />

                    {hasParty && (
                        <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                            <FormField
                                control={form.control}
                                name="same_location"
                                render={({ field }) => (
                                    <FormItem className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                                        <div className="flex items-center gap-2">
                                            <Copy className="w-4 h-4 text-gray-500" />
                                            <FormLabel className="text-sm font-medium text-gray-700">
                                                Mesmo local da cerimônia
                                            </FormLabel>
                                        </div>
                                        <FormControl>
                                            <Switch
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                        </FormControl>
                                    </FormItem>
                                )}
                            />

                            {!sameLocation && (
                                <div className="space-y-4 animate-in slide-in-from-top-2 duration-200">
                                    <FormField
                                        control={form.control}
                                        name="party_location_name"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                                    <PartyPopper className="w-4 h-4 text-orange-500" /> Local da Festa
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="Ex: Espaço Villa Real"
                                                        {...field}
                                                        className="h-12 border-2 focus:border-orange-400"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="party_address"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel className="flex items-center gap-2 text-gray-700">
                                                    <MapPin className="w-4 h-4 text-orange-500" /> Endereço da Festa
                                                </FormLabel>
                                                <FormControl>
                                                    <Textarea
                                                        placeholder="Av. Principal, 456 - Jardim, São Paulo - SP"
                                                        rows={2}
                                                        {...field}
                                                        className="resize-none border-2 focus:border-orange-400"
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            )}

                            <FormField
                                control={form.control}
                                name="party_time"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="flex items-center gap-2 text-gray-700">
                                            <Clock className="w-4 h-4 text-orange-500" /> Horário da Festa
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="time"
                                                {...field}
                                                className="h-12 border-2 focus:border-orange-400 w-40"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    )}

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
                            className="flex-1 h-14 text-lg font-semibold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg"
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

export default WizardStep4Party;

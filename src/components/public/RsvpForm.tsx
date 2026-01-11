import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Check, X, PartyPopper } from "lucide-react";
import { showSuccess, showError, showUserError } from "@/utils/toast";
import { GUEST_MESSAGES } from "@/constants/messages";

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const rsvpSchema = z.object({
    guest_name: z.string().min(2, "Nome é obrigatório"),
    guest_email: z.string().email("Email inválido"),
    guest_phone: z.string().optional(),
    attending: z.enum(["yes", "no", "maybe"], {
        required_error: "Por favor, selecione uma opção",
    }),
    companions: z.coerce.number().min(0).max(10).default(0),
    dietary_restrictions: z.string().optional(),
    message: z.string().optional(),
});

type RsvpFormData = z.infer<typeof rsvpSchema>;

interface RsvpFormProps {
    weddingListId: string;
}

const RsvpForm: React.FC<RsvpFormProps> = ({ weddingListId }) => {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const form = useForm<RsvpFormData>({
        resolver: zodResolver(rsvpSchema),
        defaultValues: {
            guest_name: "",
            guest_email: "",
            guest_phone: "",
            attending: undefined,
            companions: 0,
            dietary_restrictions: "",
            message: "",
        },
    });

    const attendingValue = form.watch("attending");

    const onSubmit = async (data: RsvpFormData) => {
        setIsSubmitting(true);
        try {
            const { error } = await supabase.from("rsvp_responses").insert({
                wedding_list_id: weddingListId,
                ...data,
            });

            if (error) {
                if (error.code === "23505") { // Unique violation
                    throw new Error(GUEST_MESSAGES.error.RSVP_DUPLICATE);
                }
                throw error;
            }

            setIsSuccess(true);
            showSuccess(GUEST_MESSAGES.success.RSVP_SENT);
            form.reset();
        } catch (error: any) {
            showUserError(error.message || GUEST_MESSAGES.error.RSVP_FAILED, error);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSuccess) {
        return (
            <Card className="max-w-xl mx-auto border-dashed border-2 border-pink-200 bg-pink-50/50">
                <CardContent className="pt-10 pb-10 text-center space-y-4">
                    <div className="mx-auto w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm">
                        <PartyPopper className="w-8 h-8 text-pink-500" />
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-800">Obrigado pela resposta!</h3>
                    <p className="text-gray-600 max-w-sm mx-auto">
                        Os noivos foram notificados. Se precisar alterar algo, entre em contato diretamente com eles.
                    </p>
                    <Button
                        variant="outline"
                        onClick={() => setIsSuccess(false)}
                        className="mt-4"
                    >
                        Enviar outra resposta
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="max-w-2xl mx-auto shadow-md">
            <CardHeader className="text-center">
                <CardTitle className="text-2xl text-gray-800">Confirmar Presença</CardTitle>
                <CardDescription>
                    Por favor, responda até para nos ajudar na organização.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="guest_name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Seu Nome Completo *</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Ex: Maria Silva" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="guest_email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email *</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="maria@email.com" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="guest_phone"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Telefone / WhatsApp</FormLabel>
                                    <FormControl>
                                        <Input placeholder="(11) 99999-9999" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="attending"
                            render={({ field }) => (
                                <FormItem className="space-y-3">
                                    <FormLabel>Você irá ao casamento?</FormLabel>
                                    <FormControl>
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col sm:flex-row gap-4"
                                        >
                                            <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-gray-50 bg-white flex-1 cursor-pointer">
                                                <FormControl>
                                                    <RadioGroupItem value="yes" />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer flex items-center gap-2 w-full">
                                                    <div className="bg-green-100 p-2 rounded-full">
                                                        <Check className="w-4 h-4 text-green-600" />
                                                    </div>
                                                    Sim, eu vou!
                                                </FormLabel>
                                            </FormItem>
                                            <FormItem className="flex items-center space-x-3 space-y-0 rounded-lg border p-4 hover:bg-gray-50 bg-white flex-1 cursor-pointer">
                                                <FormControl>
                                                    <RadioGroupItem value="no" />
                                                </FormControl>
                                                <FormLabel className="font-normal cursor-pointer flex items-center gap-2 w-full">
                                                    <div className="bg-red-100 p-2 rounded-full">
                                                        <X className="w-4 h-4 text-red-600" />
                                                    </div>
                                                    Não poderei ir
                                                </FormLabel>
                                            </FormItem>
                                        </RadioGroup>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {attendingValue === "yes" && (
                            <div className="bg-gray-50 p-4 rounded-lg space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                <FormField
                                    control={form.control}
                                    name="companions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Número de Acompanhantes (Adultos e Crianças)</FormLabel>
                                            <FormControl>
                                                <Input type="number" min="0" max="10" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Não conte você mesmo. Se for só você, coloque 0.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="dietary_restrictions"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Restrições Alimentares?</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Vegetariano, Alérgico a camarão..." {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="message"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Mensagem para os Noivos (Opcional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Deixe um recado carinhoso..."
                                            className="resize-none"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Button
                            type="submit"
                            className="w-full bg-pink-500 hover:bg-pink-600 text-lg"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                "Confirmar Resposta"
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
};

export default RsvpForm;

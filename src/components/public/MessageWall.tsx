import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquarePlus, Send, Quote } from "lucide-react";
import { showSuccess, showUserError } from "@/utils/toast";
import { GUEST_MESSAGES, UI_MESSAGES } from "@/constants/messages";
import DOMPurify from 'dompurify';

import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

// Database type definition would ideally be imported from types/index.ts
// but defining locally for simplicity during this task
interface GuestMessage {
    id: string;
    guest_name: string;
    message: string;
    created_at: string;
}

const messageSchema = z.object({
    guest_name: z.string().min(2, "Seu nome é obrigatório"),
    message: z.string().min(5, "A mensagem deve ter pelo menos 5 caracteres"),
});

type MessageFormData = z.infer<typeof messageSchema>;

interface MessageWallProps {
    weddingListId: string;
}

const MessageWall: React.FC<MessageWallProps> = ({ weddingListId }) => {
    const [messages, setMessages] = useState<GuestMessage[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<MessageFormData>({
        resolver: zodResolver(messageSchema),
        defaultValues: {
            guest_name: "",
            message: "",
        },
    });

    const fetchMessages = async () => {
        try {
            const { data, error } = await supabase
                .from("guest_messages")
                .select("*")
                .eq("wedding_list_id", weddingListId)
                .eq("is_visible", true)
                .order("created_at", { ascending: false });

            if (error) throw error;
            setMessages(data as GuestMessage[]);
        } catch (error) {
            console.error("Error fetching messages:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();

        // Subscribe to new messages
        const channel = supabase
            .channel('public:guest_messages')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'guest_messages',
                filter: `wedding_list_id=eq.${weddingListId}`
            }, (payload) => {
                const newMessage = payload.new as GuestMessage;
                if (newMessage['is_visible']) {
                    setMessages(prev => [newMessage, ...prev]);
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [weddingListId]);

    const onSubmit = async (data: MessageFormData) => {
        setIsSubmitting(true);
        try {
            // Sanitize inputs
            const sanitizedName = DOMPurify.sanitize(data.guest_name);
            const sanitizedMessage = DOMPurify.sanitize(data.message);

            const { error } = await supabase.from("guest_messages").insert({
                wedding_list_id: weddingListId,
                guest_name: sanitizedName,
                message: sanitizedMessage,
                is_visible: true // Default to visible
            });

            if (error) throw error;

            showSuccess(GUEST_MESSAGES.success.MESSAGE_SENT);
            form.reset();
            setIsDialogOpen(false);
            // Optimistic updat will happen via subscription or refetch
            fetchMessages();
        } catch (error: any) {
            showUserError(GUEST_MESSAGES.error.MESSAGE_FAILED, error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const getRandomColor = (index: number) => {
        const colors = [
            "bg-pink-50 border-pink-100",
            "bg-purple-50 border-purple-100",
            "bg-yellow-50 border-yellow-100",
            "bg-blue-50 border-blue-100",
            "bg-green-50 border-green-100",
        ];
        return colors[index % colors.length];
    }

    const getInitials = (name: string) => {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    return (
        <div className="space-y-8">
            {/* Header / Action */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                <div>
                    <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
                        <Quote className="w-5 h-5 text-[var(--brand-color)] rotate-180" />
                        Mural de Recados
                    </h3>
                    <p className="text-gray-500 text-sm">
                        Deixe uma mensagem de carinho para o casal!
                    </p>
                </div>

                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-[var(--brand-color)] hover:opacity-90 text-white shadow-md transition-all hover:-translate-y-0.5">
                            <MessageSquarePlus className="w-4 h-4 mr-2" />
                            Deixar Mensagem
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                            <DialogTitle>Escrever Mensagem</DialogTitle>
                            <DialogDescription>
                                Sua mensagem aparecerá publicamente no mural do casal.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                                <FormField
                                    control={form.control}
                                    name="guest_name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Seu Nome</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Ex: Tia Márcia" {...field} className="focus-visible:ring-[var(--brand-color)]" />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="message"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Sua Mensagem</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Desejo toda a felicidade do mundo..."
                                                    className="bg-gray-50/50 resize-none min-h-[100px] focus-visible:ring-[var(--brand-color)]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="pt-2">
                                    {/* Content moved to footer */}
                                </div>
                            </form>
                        </Form>
                        <DialogFooter className="justify-center">
                            <Button
                                onClick={form.handleSubmit(onSubmit)}
                                disabled={isSubmitting}
                                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                                Enviar Mensagem
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Messages Grid */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 text-[var(--brand-color)] animate-spin" />
                </div>
            ) : messages.length === 0 ? (
                <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <MessageSquarePlus className="w-8 h-8 text-gray-300" />
                    </div>
                    <p className="text-gray-500 font-medium">Seja o primeiro a deixar uma mensagem!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {messages.map((msg, idx) => (
                        <Card
                            key={msg.id}
                            className={`border-l-4 shadow-sm hover:shadow-md transition-shadow duration-300 ${getRandomColor(idx)}`}
                        >
                            <CardContent className="p-5">
                                <Quote className="w-8 h-8 text-black/5 mb-2 -ml-1" />
                                <p className="text-gray-700 leading-relaxed mb-6 font-medium font-serif italic relative z-10">
                                    "{msg.message}"
                                </p>

                                <div className="flex items-center gap-3 mt-auto pt-4 border-t border-black/5">
                                    <Avatar className="w-8 h-8 shadow-sm border border-white">
                                        <AvatarFallback className="text-xs bg-white text-gray-600">
                                            {getInitials(msg.guest_name)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <p className="text-sm font-bold text-gray-800">{msg.guest_name}</p>
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                                            {new Date(msg.created_at).toLocaleDateString('pt-BR')}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default MessageWall;

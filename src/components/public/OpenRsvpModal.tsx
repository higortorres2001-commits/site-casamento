import React, { useState, useCallback, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showUserError } from "@/utils/toast";
import { VALIDATION_MESSAGES } from "@/constants/messages";
import { Loader2, Users, Plus, Check, ClipboardCheck, Gift, MessageSquare } from "lucide-react";
import { nanoid } from "nanoid";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import GuestRowInput from "@/components/guests/GuestRowInput";

interface GuestRowData {
    id: string;
    name: string;
    whatsapp: string;
    guest_type: "adult" | "child";
}

interface OpenRsvpModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    weddingListId: string;
    onSuccess?: () => void;
}

const createEmptyGuest = (): GuestRowData => ({
    id: nanoid(),
    name: "",
    whatsapp: "",
    guest_type: "adult",
});

// Extract surname from full name
const extractSurname = (fullName: string): string => {
    const parts = fullName.trim().split(" ");
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return parts[0] || "";
};

// Generate slug
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) + "-" + nanoid(6);
};

const OpenRsvpModal: React.FC<OpenRsvpModalProps> = ({
    open,
    onOpenChange,
    weddingListId,
    onSuccess,
}) => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [guests, setGuests] = useState<GuestRowData[]>([createEmptyGuest()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [focusNewRow, setFocusNewRow] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [duplicateWarningOpen, setDuplicateWarningOpen] = useState(false);
    const [potentialDuplicateName, setPotentialDuplicateName] = useState("");

    // Reset when opening
    useEffect(() => {
        if (open) {
            setGuests([createEmptyGuest()]);
            setFocusNewRow(false);
            setIsSuccess(false);
            setDuplicateWarningOpen(false);
            setPotentialDuplicateName("");
        }
    }, [open]);

    const handleGuestChange = useCallback(
        (id: string, field: keyof GuestRowData, value: string) => {
            setGuests((prev) =>
                prev.map((g) => (g.id === id ? { ...g, [field]: value } : g))
            );
        },
        []
    );

    const handleDeleteGuest = useCallback((id: string) => {
        setGuests((prev) => {
            if (prev.length <= 1) return prev;
            return prev.filter((g) => g.id !== id);
        });
    }, []);

    const handleAddNew = useCallback(() => {
        setGuests((prev) => [...prev, createEmptyGuest()]);
        setFocusNewRow(true);
        setTimeout(() => setFocusNewRow(false), 100);
    }, []);

    const processRsvp = async () => {
        const validGuests = guests.filter((g) => g.name.trim());
        if (validGuests.length === 0) return;

        const firstGuestName = validGuests[0].name.trim();
        const surname = extractSurname(firstGuestName);
        const groupName = `Família ${surname} (${firstGuestName.split(' ')[0]})`;

        setIsSubmitting(true);

        try {
            const slug = generateSlug(groupName);

            // 1. Create Envelope (Source = public)
            const { data: envelope, error: envelopeError } = await supabase
                .from("envelopes")
                .insert({
                    wedding_list_id: weddingListId,
                    group_name: groupName,
                    slug,
                    source: 'public',
                })
                .select()
                .single();

            if (envelopeError) throw envelopeError;

            // 2. Create Guests
            const guestsToInsert = validGuests.map((g) => ({
                envelope_id: envelope.id,
                name: g.name.trim(),
                whatsapp: g.whatsapp.replace(/\D/g, "") || null,
                guest_type: g.guest_type,
            }));

            const { data: insertedGuests, error: guestsError } = await supabase
                .from("guests")
                .insert(guestsToInsert)
                .select();

            if (guestsError) throw guestsError;

            // 3. Auto-Confirm RSVP
            const rsvpInserts = insertedGuests.map(g => ({
                wedding_list_id: weddingListId,
                guest_id: g.id,
                guest_name: g.name,
                attending: 'yes',
                validation_status: 'validated',
                guest_phone: g.whatsapp,
                source: 'public',
            }));

            const { error: rsvpError } = await supabase
                .from("rsvp_responses")
                .insert(rsvpInserts);

            if (rsvpError) {
                console.error("Error auto-confirming RSVP:", rsvpError);
            }

            setIsSuccess(true);
            onSuccess?.();

        } catch (error: any) {
            console.error("Error saving RSVP:", error);
            showUserError("Erro ao confirmar presença. Tente novamente.", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = async () => {
        const validGuests = guests.filter((g) => g.name.trim());
        if (validGuests.length === 0) {
            showError("Adicione pelo menos um convidado.");
            return;
        }

        const firstGuest = validGuests[0];
        const firstGuestName = firstGuest.name.trim();
        const mainPhone = firstGuest.whatsapp.replace(/\D/g, "");

        // Priority 1: Phone Number Duplicate Check
        if (mainPhone) {
            try {
                const { data: existingPhones } = await supabase
                    .from("guests")
                    .select("id, name, envelopes!inner(wedding_list_id)")
                    .eq("envelopes.wedding_list_id", weddingListId)
                    .eq("whatsapp", mainPhone)
                    .limit(1);

                if (existingPhones && existingPhones.length > 0) {
                    setPotentialDuplicateName(existingPhones[0].name);
                    setDuplicateWarningOpen(true);
                    return;
                }
            } catch (err) {
                console.error("Error checking phone duplicates:", err);
            }
        }

        // Priority 2: Name Check (fallback for guests without phone)
        try {
            const { data: existingGuests } = await supabase
                .from("guests")
                .select("name, envelopes!inner(wedding_list_id)")
                .eq("envelopes.wedding_list_id", weddingListId)
                .ilike("name", `%${firstGuestName}%`)
                .limit(1);

            if (existingGuests && existingGuests.length > 0) {
                setPotentialDuplicateName(existingGuests[0].name);
                setDuplicateWarningOpen(true);
                return;
            }
        } catch (err) {
            console.error("Error checking name duplicates:", err);
        }

        await processRsvp();
    };

    const handleNavigate = (tab: "gifts" | "messages") => {
        setSearchParams({ tab });
        onOpenChange(false);
    };

    const validGuestCount = guests.filter((g) => g.name.trim()).length;

    if (isSuccess) {
        return (
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[95vw] max-w-md p-6 rounded-2xl text-center">
                    <div className="flex flex-col items-center justify-center space-y-4 py-6">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-2 animate-in zoom-in spin-in-3 duration-300">
                            <span className="text-3xl">👍</span>
                        </div>

                        <div className="space-y-2">
                            <DialogTitle className="text-2xl font-bold text-gray-800">
                                Tudo certo!
                            </DialogTitle>
                            <DialogDescription className="text-base text-gray-600">
                                Sua presença foi confirmada com sucesso.
                                <br />
                                Estamos muito felizes em ter você conosco!
                            </DialogDescription>
                        </div>

                        <div className="w-full space-y-3 pt-4">
                            <Button
                                className="w-full bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-200 h-12 text-lg"
                                onClick={() => handleNavigate("gifts")}
                            >
                                <Gift className="w-5 h-5 mr-2" />
                                Presentear os Noivos
                            </Button>

                            <button
                                onClick={() => handleNavigate("messages")}
                                className="text-sm font-medium text-gray-500 hover:text-green-600 transition-colors flex items-center justify-center gap-1 mx-auto py-2"
                            >
                                <MessageSquare className="w-4 h-4" />
                                Deixar um recado para os noivos
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6 rounded-xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl text-green-600">
                        <ClipboardCheck className="w-6 h-6" />
                        Confirmar Presença
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Adicione você e sua família abaixo para confirmar a presença no casamento.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2 sm:py-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pr-1">

                    {/* Security Tip */}
                    <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 flex gap-3 shadow-sm">
                        <div className="bg-yellow-100 p-1.5 rounded-full h-fit flex-shrink-0">
                            <Users className="w-4 h-4 text-yellow-700" />
                        </div>
                        <div className="text-sm text-yellow-800">
                            <p className="font-medium mb-0.5">Importante</p>
                            <p className="text-yellow-800/90 leading-relaxed text-xs sm:text-sm">
                                Preencha o nome completo de todos que irão com você. Não esqueça das crianças!
                            </p>
                        </div>
                    </div>

                    {/* Guest List */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <Label>Pessoas Confirmadas</Label>
                            <span className="text-xs text-gray-400">{validGuestCount} pessoa(s)</span>
                        </div>
                        <div className="space-y-3 sm:space-y-2">
                            {guests.map((guest, index) => (
                                <GuestRowInput
                                    key={guest.id}
                                    guest={guest}
                                    index={index}
                                    isLast={index === guests.length - 1}
                                    onChange={handleGuestChange}
                                    onDelete={handleDeleteGuest}
                                    onAddNew={handleAddNew}
                                    autoFocus={focusNewRow && index === guests.length - 1}
                                // Make placeholders more "public facing" friendly if needed, 
                                // but GuestRowInput is generic enough.
                                />
                            ))}
                        </div>

                        {/* Add New Button */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddNew}
                            className="w-full border-dashed text-gray-500 hover:text-green-600 hover:border-green-300 h-10 mt-2"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar Mais Alguém
                        </Button>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 mt-2 sm:mt-0">
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-3 sm:gap-0">
                        <span className="text-sm text-gray-500 hidden sm:inline-block">
                            Total: {validGuestCount}
                        </span>
                        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                            <Button
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                                disabled={isSubmitting}
                                className="w-full sm:w-auto"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting || validGuestCount === 0}
                                className="bg-green-600 hover:bg-green-700 text-white w-full sm:w-auto"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Confirmando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-2" />
                                        Confirmar Presença
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
                <AlertDialog open={duplicateWarningOpen} onOpenChange={setDuplicateWarningOpen}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Você já confirmou?</AlertDialogTitle>
                            <AlertDialogDescription>
                                Encontramos um registro compatível (Nome ou Telefone) para <strong>{potentialDuplicateName}</strong> na lista.
                                <br /><br />
                                Se você já confirmou, não precisa fazer de novo. Se precisar alterar algo (como número de acompanhantes), entre em contato com os noivos.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
                            <AlertDialogCancel
                                className="bg-green-50 text-green-700 hover:bg-green-100 border-green-200 mt-0 sm:mt-0"
                                onClick={() => {
                                    setDuplicateWarningOpen(false);
                                    showSuccess("Entre em contato com os noivos para acessar seu convite.");
                                    onOpenChange(false);
                                }}
                            >
                                Sou eu (Já cadastrado)
                            </AlertDialogCancel>
                            <AlertDialogAction
                                className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                                onClick={() => {
                                    setDuplicateWarningOpen(false);
                                    processRsvp();
                                }}
                            >
                                Não sou eu (Continuar)
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    );
};

export default OpenRsvpModal;

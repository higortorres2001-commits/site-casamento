import React, { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES, VALIDATION_MESSAGES } from "@/constants/messages";
import { Loader2, Users, Plus } from "lucide-react";
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

import GuestRowInput from "./GuestRowInput";

interface GuestRowData {
    id: string;
    name: string;
    whatsapp: string;
    guest_type: "adult" | "child";
}

interface EnvelopeFormModalProps {
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

// Generate slug from group name
const generateSlug = (name: string): string => {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // Remove accents
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 50) + "-" + nanoid(6);
};

const EnvelopeFormModal: React.FC<EnvelopeFormModalProps> = ({
    open,
    onOpenChange,
    weddingListId,
    onSuccess,
}) => {
    const [groupName, setGroupName] = useState("");
    const [guests, setGuests] = useState<GuestRowData[]>([createEmptyGuest()]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [focusNewRow, setFocusNewRow] = useState(false);

    // Reset form when modal opens
    useEffect(() => {
        if (open) {
            setGroupName("");
            setGuests([createEmptyGuest()]);
            setFocusNewRow(false);
        }
    }, [open]);

    // Smart default: Extract surname from first guest
    const getSmartGroupName = useCallback(() => {
        if (groupName.trim()) return groupName;
        const firstGuestWithName = guests.find((g) => g.name.trim());
        if (firstGuestWithName) {
            const surname = extractSurname(firstGuestWithName.name);
            return `Família ${surname}`;
        }
        return "";
    }, [groupName, guests]);

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
            if (prev.length <= 1) return prev; // Keep at least one row
            return prev.filter((g) => g.id !== id);
        });
    }, []);

    const handleAddNew = useCallback(() => {
        setGuests((prev) => [...prev, createEmptyGuest()]);
        setFocusNewRow(true);
        // Reset focus flag after render
        setTimeout(() => setFocusNewRow(false), 100);
    }, []);

    const handleSubmit = async () => {
        // Validate
        const validGuests = guests.filter((g) => g.name.trim());
        if (validGuests.length === 0) {
            showError(VALIDATION_MESSAGES.MIN_GUESTS);
            return;
        }

        const finalGroupName = getSmartGroupName();
        if (!finalGroupName) {
            showError(VALIDATION_MESSAGES.GROUP_NAME_REQUIRED);
            return;
        }

        setIsSubmitting(true);

        try {
            // Create envelope
            let slug = generateSlug(finalGroupName);

            // Check for duplicate slug and append suffix if needed
            let isUnique = false;
            let counter = 0;
            const originalSlug = slug;

            while (!isUnique) {
                const { data: existing } = await supabase
                    .from("envelopes")
                    .select("id")
                    .eq("slug", slug)
                    .maybeSingle();

                if (!existing) {
                    isUnique = true;
                } else {
                    counter++;
                    slug = `${originalSlug}-${counter}`;
                }
            }
            const { data: envelope, error: envelopeError } = await supabase
                .from("envelopes")
                .insert({
                    wedding_list_id: weddingListId,
                    group_name: finalGroupName,
                    slug,
                })
                .select()
                .single();

            if (envelopeError) throw envelopeError;

            // Create guests
            const guestsToInsert = validGuests.map((g) => ({
                envelope_id: envelope.id,
                name: g.name.trim(),
                whatsapp: g.whatsapp.replace(/\D/g, "") || null,
                guest_type: g.guest_type,
            }));

            const { error: guestsError } = await supabase
                .from("guests")
                .insert(guestsToInsert);

            if (guestsError) throw guestsError;

            showSuccess(
                `Família "${finalGroupName}" salva com ${validGuests.length} convidado(s)!`
            );
            onOpenChange(false);
            onSuccess?.();
        } catch (error: any) {
            console.error("Error saving envelope:", error);
            showUserError(ADMIN_MESSAGES.error.SAVE_FAILED, error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const validGuestCount = guests.filter((g) => g.name.trim()).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[95vw] max-w-lg sm:max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-4 sm:p-6 rounded-xl">
                <DialogHeader className="pb-2">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <Users className="w-5 h-5 text-pink-500" />
                        Novo Convite / Família
                    </DialogTitle>
                    <DialogDescription className="text-sm">
                        Adicione os membros da família. Use Enter para nova linha.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto space-y-4 py-2 sm:py-4 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent pr-1">
                    {/* Security Tip */}
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 shadow-sm">
                        <div className="bg-blue-100 p-1.5 rounded-full h-fit flex-shrink-0">
                            <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="text-sm text-blue-800">
                            <p className="font-medium mb-0.5">Dica de Segurança</p>
                            <p className="text-blue-700/90 leading-relaxed text-xs sm:text-sm">
                                Adicione o WhatsApp dos convidados. No dia da confirmação, solicitaremos os <span className="font-semibold">4 últimos dígitos</span> para segurança.
                            </p>
                        </div>
                    </div>

                    {/* Group Name */}
                    <div className="space-y-1.5">
                        <Label htmlFor="groupName" className="text-sm font-medium">
                            Nome no Convite{" "}
                            <span className="text-gray-400 font-normal">
                                (Ex: Família Souza)
                            </span>
                        </Label>
                        <Input
                            id="groupName"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder={getSmartGroupName() || "Deixe em branco para auto-preencher"}
                            className="bg-white h-10 border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                        />
                        {!groupName && getSmartGroupName() && (
                            <p className="text-xs text-gray-500 ml-1">
                                Será salvo como: <strong>{getSmartGroupName()}</strong>
                            </p>
                        )}
                    </div>

                    {/* Guest List */}
                    <div className="space-y-2">
                        <div className="flex justify-between items-center px-1">
                            <Label>Membros da Família</Label>
                            <span className="text-xs text-gray-400">{validGuestCount} convidado(s)</span>
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
                                />
                            ))}
                        </div>

                        {/* Add New Button */}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddNew}
                            className="w-full border-dashed text-gray-500 hover:text-pink-600 hover:border-pink-300 h-10 mt-2"
                        >
                            <Plus className="w-4 h-4 mr-1" />
                            Adicionar Membro
                        </Button>
                    </div>
                </div>

                <DialogFooter className="border-t pt-4 mt-2 sm:mt-0">
                    <div className="flex flex-col-reverse sm:flex-row items-center justify-between w-full gap-3 sm:gap-0">
                        <span className="text-sm text-gray-500 hidden sm:inline-block">
                            {validGuestCount} convidado(s)
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
                                className="bg-pink-500 hover:bg-pink-600 w-full sm:w-auto"
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    "Salvar Família"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default EnvelopeFormModal;

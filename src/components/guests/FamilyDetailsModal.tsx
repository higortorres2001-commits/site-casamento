import React, { useEffect, useState } from "react";
import { cleanPhoneNumber } from "@/utils/phone-formatter";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Check, X, Loader2, Baby, User, Send, UserCheck, UserX, Trash2 } from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";
import { showSuccess, showError } from "@/utils/toast";
import type { Envelope, Guest } from "@/types";
import ConfirmDialog from "@/components/ui/confirm-dialog";

interface FamilyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    envelope: Envelope & { guests: Guest[] };
    weddingListId: string;
    weddingListSlug?: string;
    onUpdate: () => void;
}

type RsvpStatus = {
    id: string;
    guest_name: string;
    attending: "yes" | "no" | null;
    validation_status: "pending" | "validated" | "rejected";
    source: string;
    guest_phone: string | null;
};

const FamilyDetailsModal: React.FC<FamilyDetailsModalProps> = ({
    isOpen,
    onClose,
    envelope,
    weddingListId,
    weddingListSlug,
    onUpdate,
}) => {
    const [loading, setLoading] = useState(true);
    const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [editingGuest, setEditingGuest] = useState<{ id: string; field: string; value: string } | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; guestId: string; guestName: string }>({ open: false, guestId: "", guestName: "" });

    useEffect(() => {
        if (isOpen && envelope) {
            loadRsvpData();
        }
    }, [isOpen, envelope]);

    const loadRsvpData = async () => {
        setLoading(true);
        try {
            const guestIds = envelope.guests.map(g => g.id);

            const { data, error } = await supabase
                .from("rsvp_responses")
                .select("*")
                .eq("wedding_list_id", weddingListId)
                .in("guest_id", guestIds);

            if (error) throw error;

            const rsvpMap: Record<string, RsvpStatus> = {};
            data?.forEach((rsvp) => {
                if (rsvp.guest_id) {
                    rsvpMap[rsvp.guest_id] = rsvp;
                }
            });
            setRsvps(rsvpMap);
        } catch (error) {
            console.error("Error loading RSVPs:", error);
            showError("Erro ao carregar status");
        } finally {
            setLoading(false);
        }
    };

    const handleValidate = async (guestId: string, status: "validated" | "rejected") => {
        setProcessingId(guestId);
        try {
            const { error } = await supabase
                .from("rsvp_responses")
                .update({ validation_status: status })
                .eq("wedding_list_id", weddingListId)
                .eq("guest_id", guestId);

            if (error) throw error;

            setRsvps(prev => ({
                ...prev,
                [guestId]: { ...prev[guestId], validation_status: status }
            }));

            showSuccess(status === "validated" ? "Presença validada!" : "Presença rejeitada");
            onUpdate();
        } catch (error) {
            console.error("Error updating status:", error);
            showError("Erro ao atualizar status");
        } finally {
            setProcessingId(null);
        }
    };

    const handleUpdateGuest = async (guestId: string, updates: Partial<Guest>) => {
        try {
            // Normalize whatsapp if present
            const normalizedUpdates = { ...updates };
            if (normalizedUpdates.whatsapp) {
                normalizedUpdates.whatsapp = cleanPhoneNumber(normalizedUpdates.whatsapp);
            }

            const { error } = await supabase
                .from("guests")
                .update(normalizedUpdates)
                .eq("id", guestId);

            if (error) throw error;
            showSuccess("Atualizado!");
            onUpdate();
            setEditingGuest(null);
        } catch (error) {
            console.error("Error updating guest:", error);
            showError("Erro ao atualizar convidado");
        }
    };

    const handleDeleteGuest = async (guestId: string) => {
        try {
            // Delete RSVP responses first (foreign key dependency)
            await supabase
                .from("rsvp_responses")
                .delete()
                .eq("guest_id", guestId);

            // Delete guest
            const { error } = await supabase
                .from("guests")
                .delete()
                .eq("id", guestId);

            if (error) throw error;
            showSuccess("Convidado removido!");
            setDeleteConfirm({ open: false, guestId: "", guestName: "" });
            onUpdate();
        } catch (error) {
            console.error("Error deleting guest:", error);
            showError("Erro ao remover convidado");
        }
    };

    // Manual confirm/cancel presence
    const handleManualRsvp = async (guestId: string, guestName: string, attending: "yes" | "no") => {
        setProcessingId(guestId);
        try {
            // First, check if an RSVP record exists in the database (not local state)
            const { data: existingRsvp, error: checkError } = await supabase
                .from("rsvp_responses")
                .select("id")
                .eq("wedding_list_id", weddingListId)
                .eq("guest_id", guestId)
                .maybeSingle();

            if (checkError) throw checkError;

            if (existingRsvp) {
                // Update existing record
                const { error } = await supabase
                    .from("rsvp_responses")
                    .update({
                        attending,
                        guest_name: guestName,
                        validation_status: "validated",
                        source: "manual_admin",
                    })
                    .eq("id", existingRsvp.id);

                if (error) throw error;
            } else {
                // Create new record
                const { error } = await supabase
                    .from("rsvp_responses")
                    .insert({
                        wedding_list_id: weddingListId,
                        guest_id: guestId,
                        guest_name: guestName,
                        attending,
                        validation_status: "validated",
                        source: "manual_admin",
                    });

                if (error) throw error;
            }

            // Update local state
            setRsvps(prev => ({
                ...prev,
                [guestId]: {
                    ...prev[guestId],
                    id: prev[guestId]?.id || guestId,
                    guest_name: guestName,
                    attending,
                    validation_status: "validated",
                    source: "manual_admin",
                    guest_phone: prev[guestId]?.guest_phone || null,
                }
            }));

            showSuccess(attending === "yes" ? "Presença confirmada manualmente!" : "Ausência registrada!");
            onUpdate();
        } catch (error) {
            console.error("Error with manual RSVP:", error);
            showError("Erro ao atualizar presença");
        } finally {
            setProcessingId(null);
        }
    };

    // Generate WhatsApp link
    const getWhatsAppLink = (guest: Guest) => {
        const phone = guest.whatsapp || rsvps[guest.id]?.guest_phone;
        const baseUrl = window.location.origin;

        // Build the message
        let link: string;
        let message: string;

        if (weddingListSlug) {
            // Link with envelope slug parameter
            link = `${baseUrl}/lista/${weddingListSlug}?envelope=${encodeURIComponent(envelope.slug)}`;
            message = `Olá ${guest.name.split(' ')[0]}! 💒✨\n\nVocê está convidado(a) para o nosso casamento! Confirme sua presença pelo link:\n\n${link}`;
        } else {
            // Generic link (no slug available)
            link = baseUrl;
            message = `Olá ${guest.name.split(' ')[0]}! 💒✨\n\nVocê está convidado(a) para o nosso casamento! Acesse o site para confirmar sua presença.`;
        }

        if (phone) {
            // Clean phone number (remove non-digits, ensure country code)
            const cleanPhone = phone.replace(/\D/g, '');
            const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
            return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
        } else {
            // No phone - open WhatsApp with pre-filled message to share
            return `https://wa.me/?text=${encodeURIComponent(message)}`;
        }
    };

    const StatusBadge = ({ rsvp }: { rsvp?: RsvpStatus }) => {
        if (!rsvp) return <Badge variant="outline" className="bg-gray-50 text-gray-500">Sem resposta</Badge>;

        if (rsvp.attending === "no") {
            return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Não vai</Badge>;
        }

        if (rsvp.validation_status === "validated") {
            return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Confirmado</Badge>;
        }

        if (rsvp.validation_status === "rejected") {
            return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">Rejeitado</Badge>;
        }

        return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 animate-pulse">Pendente</Badge>;
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            {envelope.group_name}
                            <Badge variant="outline" className="ml-2 font-normal">
                                {envelope.guests.length} convidados
                            </Badge>
                            {envelope.source === 'public' && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 text-xs">
                                    Site
                                </Badge>
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            Gerencie as confirmações de presença desta família/grupo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex-1 overflow-y-auto mt-4 pr-1">
                        {loading ? (
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin mx-auto text-pink-500" />
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <div className="hidden sm:block">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Nome</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>WhatsApp</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead className="text-right">Ações</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {envelope.guests.map((guest, index) => {
                                                const rsvp = rsvps[guest.id];
                                                return (
                                                    <TableRow key={guest.id}>
                                                        <TableCell className="font-medium p-2">
                                                            <Input
                                                                className="h-8 border-transparent hover:border-gray-200 focus:border-pink-500 bg-transparent px-2"
                                                                defaultValue={guest.name}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const newValue = e.currentTarget.value;
                                                                        if (newValue !== guest.name && newValue.trim()) {
                                                                            handleUpdateGuest(guest.id, { name: newValue });
                                                                        }
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                                placeholder="Pressione Enter para salvar"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2 w-[120px]">
                                                            <select
                                                                className="flex h-8 w-full items-center justify-between rounded-md border border-transparent bg-transparent px-2 py-1 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 hover:border-gray-200"
                                                                defaultValue={guest.guest_type}
                                                                onChange={(e) => handleUpdateGuest(guest.id, { guest_type: e.target.value as "adult" | "child" })}
                                                            >
                                                                <option value="adult">Adulto</option>
                                                                <option value="child">Criança</option>
                                                            </select>
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <Input
                                                                className="h-8 border-transparent hover:border-gray-200 focus:border-pink-500 bg-transparent px-2"
                                                                defaultValue={guest.whatsapp || ""}
                                                                placeholder="Enter para salvar"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        const newVal = e.currentTarget.value;
                                                                        if (newVal !== (guest.whatsapp || "")) {
                                                                            handleUpdateGuest(guest.id, { whatsapp: newVal || null });
                                                                        }
                                                                        e.currentTarget.blur();
                                                                    }
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell className="p-2">
                                                            <StatusBadge rsvp={rsvp} />
                                                        </TableCell>
                                                        <TableCell className="text-right p-2">
                                                            <div className="flex justify-end gap-1">
                                                                <Button
                                                                    size="icon"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                    onClick={() => window.open(getWhatsAppLink(guest), '_blank')}
                                                                    title="Enviar WhatsApp"
                                                                >
                                                                    <WhatsAppIcon className="w-4 h-4" />
                                                                </Button>

                                                                {/* Force Manual Confirm */}
                                                                {(!rsvp || rsvp.attending !== "yes") && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                                        onClick={() => handleManualRsvp(guest.id, guest.name, "yes")}
                                                                        disabled={!!processingId}
                                                                        title="Confirmar Presença"
                                                                    >
                                                                        <UserCheck className="w-4 h-4" />
                                                                    </Button>
                                                                )}

                                                                {/* Force Manual Cancel */}
                                                                {(!rsvp || rsvp.attending !== "no") && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                        onClick={() => handleManualRsvp(guest.id, guest.name, "no")}
                                                                        disabled={!!processingId}
                                                                        title="Marcar como Ausente"
                                                                    >
                                                                        <UserX className="w-4 h-4" />
                                                                    </Button>
                                                                )}

                                                                {/* Delete Guest */}
                                                                {envelope.guests.length > 1 && (
                                                                    <Button
                                                                        size="icon"
                                                                        variant="ghost"
                                                                        className="h-8 w-8 text-gray-600 hover:text-red-700 hover:bg-red-50"
                                                                        onClick={() => setDeleteConfirm({ open: true, guestId: guest.id, guestName: guest.name })}
                                                                        disabled={!!processingId}
                                                                        title="Remover Convidado"
                                                                    >
                                                                        <Trash2 className="w-4 h-4" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>

                                {/* Mobile List (Cards) - simplified for brevity, assume synced */}
                                <div className="space-y-4 sm:hidden">
                                    {envelope.guests.map((guest) => {
                                        const rsvp = rsvps[guest.id];
                                        return (
                                            <div key={guest.id} className="bg-gray-50 rounded-lg p-3 border border-gray-100 flex flex-col gap-3">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{guest.name}</p>
                                                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                                            <span>{guest.guest_type === "child" ? "👶 Criança" : "👤 Adulto"}</span>
                                                            {(guest.whatsapp || rsvp?.guest_phone) && (
                                                                <span className="flex items-center gap-1 text-green-600">
                                                                    <WhatsAppIcon className="w-3 h-3" />
                                                                    {guest.whatsapp || rsvp?.guest_phone}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <StatusBadge rsvp={rsvp} />
                                                </div>

                                                {/* Actions */}
                                                <div className="flex flex-wrap gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="flex-1 min-w-[100px] text-green-600 hover:text-green-700 hover:bg-green-50 h-9"
                                                        onClick={() => window.open(getWhatsAppLink(guest), '_blank')}
                                                    >
                                                        <WhatsAppIcon className="w-4 h-4 mr-2" /> Enviar
                                                    </Button>
                                                    {(!rsvp || rsvp.attending !== "yes") && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 min-w-[100px] text-green-600 hover:text-green-700 hover:bg-green-50 h-9"
                                                            onClick={() => handleManualRsvp(guest.id, guest.name, "yes")}
                                                            disabled={!!processingId}
                                                        >
                                                            <UserCheck className="w-4 h-4 mr-2" /> Confirmar
                                                        </Button>
                                                    )}
                                                    {(!rsvp || rsvp.attending !== "no") && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 min-w-[100px] text-red-600 hover:text-red-700 hover:bg-red-50 h-9"
                                                            onClick={() => handleManualRsvp(guest.id, guest.name, "no")}
                                                            disabled={!!processingId}
                                                        >
                                                            <UserX className="w-4 h-4 mr-2" /> Ausente
                                                        </Button>
                                                    )}
                                                </div>
                                                {/* Validate/Reject Pending */}
                                                {rsvp?.attending === "yes" && rsvp?.validation_status === "pending" && (
                                                    <div className="flex gap-2 mt-1 pt-2 border-t border-gray-200">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 h-9"
                                                            onClick={() => handleValidate(guest.id, "rejected")}
                                                            disabled={!!processingId}
                                                        >
                                                            <X className="w-4 h-4 mr-2" /> Rejeitar
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white h-9"
                                                            onClick={() => handleValidate(guest.id, "validated")}
                                                            disabled={!!processingId}
                                                        >
                                                            {processingId === guest.id ? (
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                            ) : (
                                                                <>
                                                                    <Check className="w-4 h-4 mr-2" /> Validar
                                                                </>
                                                            )}
                                                        </Button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>

                    <DialogFooter className="flex-col sm:flex-row gap-2 mt-4 pt-4 border-t">
                        <div className="flex-1 text-xs text-gray-500 flex items-center justify-between sm:justify-start gap-4">
                            <span>Código: <code className="bg-gray-100 px-1 rounded">{envelope.slug}</code></span>
                            {envelope.source === 'public' && (
                                <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                                    Via Site
                                </span>
                            )}
                        </div>
                        <Button variant="outline" onClick={onClose}>
                            Fechar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                isOpen={deleteConfirm.open}
                onClose={(confirmed) => {
                    if (confirmed) {
                        handleDeleteGuest(deleteConfirm.guestId);
                    } else {
                        setDeleteConfirm({ open: false, guestId: "", guestName: "" });
                    }
                }}
                title="Remover Convidado"
                description={`Tem certeza que deseja remover ${deleteConfirm.guestName} deste grupo? Esta ação não pode ser desfeita.`}
                confirmText="Remover"
                cancelText="Cancelar"
                isDestructive
            />
        </>
    );
}

export default FamilyDetailsModal;

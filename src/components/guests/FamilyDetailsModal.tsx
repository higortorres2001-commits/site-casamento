import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Check, X, Loader2, Baby, User, MessageCircle, AlertCircle } from "lucide-react";
import { showSuccess, showError } from "@/utils/toast";
import type { Envelope, Guest } from "@/types";

interface FamilyDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    envelope: Envelope & { guests: Guest[] };
    weddingListId: string;
    onUpdate: () => void;
}

type RsvpStatus = {
    id: string; // guest id (from our logic in EnvelopeRsvp) or real id
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
    onUpdate,
}) => {
    const [loading, setLoading] = useState(true);
    const [rsvps, setRsvps] = useState<Record<string, RsvpStatus>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && envelope) {
            loadRsvpData();
        }
    }, [isOpen, envelope]);

    const loadRsvpData = async () => {
        setLoading(true);
        try {
            // Fetch RSVP responses by guest_id (proper FK relationship)
            const guestIds = envelope.guests.map(g => g.id);

            const { data, error } = await supabase
                .from("rsvp_responses")
                .select("*")
                .eq("wedding_list_id", weddingListId)
                .in("guest_id", guestIds);

            if (error) throw error;

            const rsvpMap: Record<string, RsvpStatus> = {};
            data?.forEach((rsvp) => {
                // Key by guest_id for reliable matching
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
            onUpdate(); // Refresh parent stats
        } catch (error) {
            console.error("Error updating status:", error);
            showError("Erro ao atualizar status");
        } finally {
            setProcessingId(null);
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
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] sm:w-full max-w-3xl max-h-[90vh] flex flex-col p-4 sm:p-6">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        {envelope.group_name}
                        <Badge variant="outline" className="ml-2 font-normal">
                            {envelope.guests.length} convidados
                        </Badge>
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
                                        {envelope.guests.map((guest) => {
                                            const rsvp = rsvps[guest.id];
                                            return (
                                                <TableRow key={guest.id}>
                                                    <TableCell className="font-medium">{guest.name}</TableCell>
                                                    <TableCell>
                                                        {guest.guest_type === "child" ? (
                                                            <div className="flex items-center gap-1 text-gray-500">
                                                                <Baby className="w-4 h-4" /> Criança
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-gray-500">
                                                                <User className="w-4 h-4" /> Adulto
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {(guest.whatsapp || rsvp?.guest_phone) ? (
                                                            <div className="flex items-center gap-1 text-green-600">
                                                                <MessageCircle className="w-4 h-4" />
                                                                <span className="text-xs">
                                                                    {guest.whatsapp || rsvp?.guest_phone}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-400 text-xs">-</span>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge rsvp={rsvp} />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {rsvp?.attending === "yes" && rsvp?.validation_status === "pending" && (
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                    onClick={() => handleValidate(guest.id, "rejected")}
                                                                    disabled={!!processingId}
                                                                    title="Rejeitar"
                                                                >
                                                                    <X className="w-4 h-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700 text-white"
                                                                    onClick={() => handleValidate(guest.id, "validated")}
                                                                    disabled={!!processingId}
                                                                    title="Validar"
                                                                >
                                                                    {processingId === guest.id ? (
                                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                                    ) : (
                                                                        <Check className="w-4 h-4" />
                                                                    )}
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Mobile List (Cards) */}
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
                                                                <MessageCircle className="w-3 h-3" />
                                                                {guest.whatsapp || rsvp?.guest_phone}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <StatusBadge rsvp={rsvp} />
                                            </div>

                                            {rsvp?.attending === "yes" && rsvp?.validation_status === "pending" && (
                                                <div className="flex gap-2 mt-1">
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
            </DialogContent>
        </Dialog>
    );
};

export default FamilyDetailsModal;

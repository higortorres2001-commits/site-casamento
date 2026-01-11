"use client";

import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { showSuccess, showError } from "@/utils/toast";
import { useNavigate } from "react-router-dom";
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
import {
    ArrowRight,
    Baby,
    Check,
    ChevronRight,
    Clock,
    Gift,
    Loader2,
    Mail,
    MessageSquare,
    PartyPopper,
    Phone,
    Plus,
    Search,
    User,
    UserPlus,
    Users,
    X,
} from "lucide-react";
import Fuse from "fuse.js";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatWhatsapp } from "@/utils/whatsappValidation";

interface Guest {
    id: string;
    name: string;
    envelope_id: string;
    guest_type: "adult" | "child";
    group_name: string;
    has_whatsapp?: boolean;
}

interface FamilyMember extends Guest {
    attending: "yes" | "no" | null;
    whatsapp: string;
    isNew?: boolean;
}

interface EnvelopeRsvpProps {
    weddingListId: string;
    weddingSlug?: string;
    envelopeSlug?: string; // For magic link direct access
}

type Step = "search" | "rsvp" | "success";
type RsvpSource = "magic_link" | "public_search";

const EnvelopeRsvp: React.FC<EnvelopeRsvpProps> = ({ weddingListId, weddingSlug, envelopeSlug }) => {
    const navigate = useNavigate();

    const [step, setStep] = useState<Step>(envelopeSlug ? "rsvp" : "search");
    const [rsvpSource, setRsvpSource] = useState<RsvpSource>(envelopeSlug ? "magic_link" : "public_search");
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<Guest[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [groupName, setGroupName] = useState("");
    const [isLoadingFamily, setIsLoadingFamily] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showAddCompanion, setShowAddCompanion] = useState(false);
    const [newCompanionName, setNewCompanionName] = useState("");
    const [newCompanionType, setNewCompanionType] = useState<"adult" | "child">("adult");
    const [confirmedCount, setConfirmedCount] = useState({ adults: 0, children: 0 });
    const [envelopeId, setEnvelopeId] = useState<string | null>(envelopeSlug ? null : null);
    const [allGuests, setAllGuests] = useState<Guest[]>([]);
    const [showPartialAlert, setShowPartialAlert] = useState(false);
    const [pendingSubmission, setPendingSubmission] = useState(false);

    // Verification State
    const [showVerifyDialog, setShowVerifyDialog] = useState(false);
    const [verifyingGuest, setVerifyingGuest] = useState<string | null>(null);
    const [verificationDigits, setVerificationDigits] = useState("");
    const [verificationError, setVerificationError] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);

    // Determine current steps based on envelopeSlug presence
    // If slug exists, we skip search (step='rsvp'), but we might still want to load guests in background if user goes back?
    // Actually, if we are in 'search' mode, we MUST load all guests.

    // Load guests securely via Edge Function only when searching
    // Removed client-side loading of all guests to prevent enumeration
    useEffect(() => {
        // Cleaning up old logic
    }, [weddingListId]);

    // Direct access via magic link
    useEffect(() => {
        if (envelopeSlug && weddingListId) {
            loadEnvelopeBySlug(envelopeSlug);
        }
    }, [envelopeSlug, weddingListId]);

    const loadEnvelopeBySlug = async (slug: string) => {
        setIsLoadingFamily(true);
        try {
            // Find envelope by slug
            const { data: envelope, error: envelopeError } = await supabase
                .from("envelopes")
                .select("id, group_name, wedding_list_id")
                .eq("slug", slug)
                .eq("wedding_list_id", weddingListId)
                .single();

            if (envelopeError || !envelope) {
                showError("Convite não encontrado");
                setStep("search");
                return;
            }

            setGroupName(envelope.group_name);
            setEnvelopeId(envelope.id);

            // Load family members securely (using has_whatsapp instead of whatsapp)
            const { data: guests, error: guestsError } = await supabase
                .from("guests")
                .select("id, name, guest_type, has_whatsapp, envelope_id")
                .eq("envelope_id", envelope.id);

            if (guestsError) throw guestsError;

            const members: FamilyMember[] = (guests || []).map((g) => ({
                ...g,
                group_name: envelope.group_name,
                attending: null,
                whatsapp: "", // Hidden by default, verified later
            }));

            setFamilyMembers(members);
            setStep("rsvp");
        } catch (err) {
            showError("Erro ao carregar convite");
            console.error(err);
            setStep("search");
        } finally {
            setIsLoadingFamily(false);
        }
    };

    const handleSearch = async (value: string) => {
        setSearchQuery(value);

        if (!value || value.length < 4) {
            setSearchResults([]);
            return;
        }

        setIsSearching(true);
        try {
            const { data: results, error } = await supabase.functions.invoke('search-guests', {
                body: { query: value, weddingListId }
            });

            if (error) {
                console.error("Search error:", error);
                setSearchResults([]);
                return;
            }

            if (results && results.guests) {
                setSearchResults(results.guests);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const loadFamilyMembers = useCallback(async (envelopeId: string) => {
        setIsLoadingFamily(true);
        try {
            const { data, error } = await supabase
                .from("guests")
                .select("id, name, guest_type, has_whatsapp, envelope_id")
                .eq("envelope_id", envelopeId);

            if (error) throw error;

            const members: FamilyMember[] = (data || []).map((g) => ({
                ...g,
                group_name: groupName,
                attending: null,
                whatsapp: "", // Hidden
            }));

            setFamilyMembers(members);
            setStep("rsvp");
        } catch (err) {
            showError("Erro ao carregar família");
            console.error(err);
        } finally {
            setIsLoadingFamily(false);
        }
    }, [groupName]);

    const handleSelectGuest = (guest: Guest) => {
        setSelectedGuest(guest);
        setGroupName(guest.group_name);
        setShowConfirmDialog(true);
    };

    const handleConfirmFamily = () => {
        setShowConfirmDialog(false);
        if (selectedGuest) {
            loadFamilyMembers(selectedGuest.envelope_id);
        }
    };

    const toggleAttendance = (memberId: string, attending: "yes" | "no") => {
        // If saying YES and guest has whatsapp, verify it first
        if (attending === "yes") {
            const member = familyMembers.find(m => m.id === memberId);
            if (member && member.has_whatsapp && !member.whatsapp) {
                setVerifyingGuest(memberId);
                setShowVerifyDialog(true);
                setVerificationDigits("");
                setVerificationError(false);
                return;
            }
        }

        setFamilyMembers((prev) =>
            prev.map((m) =>
                m.id === memberId
                    ? { ...m, attending, whatsapp: attending === "no" ? "" : m.whatsapp }
                    : m
            )
        );
    };

    const handleVerifySubmit = async () => {
        if (verificationDigits.length !== 4) {
            setVerificationError(true);
            return;
        }

        setIsVerifying(true);
        try {
            const { data, error } = await supabase.rpc('verify_guest_identity', {
                p_guest_id: verifyingGuest,
                p_last_4: verificationDigits
            });

            if (error) throw error;

            if (data && data.valid) {
                // Success
                setShowVerifyDialog(false);
                // Update member: set attending YES and populate phone
                setFamilyMembers((prev) =>
                    prev.map((m) =>
                        m.id === verifyingGuest
                            ? { ...m, attending: "yes", whatsapp: data.phone || "" }
                            : m
                    )
                );
                showSuccess("Verificado com sucesso!");
            } else {
                setVerificationError(true);
                showError("Dígitos incorretos");
            }
        } catch (err) {
            console.error(err);
            showError("Erro na verificação");
        } finally {
            setIsVerifying(false);
        }
    };

    const updateWhatsapp = (memberId: string, whatsapp: string) => {
        setFamilyMembers((prev) =>
            prev.map((m) =>
                m.id === memberId ? { ...m, whatsapp: formatWhatsapp(whatsapp) } : m
            )
        );
    };

    const handleAddCompanion = () => {
        if (!newCompanionName.trim()) {
            showError("Digite o nome do acompanhante");
            return;
        }

        const newMember: FamilyMember = {
            id: `new-${Date.now()}`,
            name: newCompanionName.trim(),
            envelope_id: selectedGuest?.envelope_id || "",
            guest_type: newCompanionType,
            group_name: groupName,
            attending: "yes",
            whatsapp: "",
            isNew: true,
        };

        setFamilyMembers((prev) => [...prev, newMember]);
        setNewCompanionName("");
        setNewCompanionType("adult");
        setShowAddCompanion(false);
        showSuccess(`${newCompanionName} adicionado!`);
    };

    const handleSubmit = async (force: boolean = false) => {
        const membersWithResponse = familyMembers.filter((m) => m.attending !== null);
        const unrespondedCount = familyMembers.filter((m) => m.attending === null).length;

        if (membersWithResponse.length === 0) {
            showError("Por favor, confirme pelo menos uma pessoa");
            return;
        }

        if (unrespondedCount > 0 && !force && !pendingSubmission) {
            setShowPartialAlert(true);
            return;
        }

        setIsSubmitting(true);
        setShowPartialAlert(false);

        try {
            for (const member of membersWithResponse) {
                if (member.isNew && member.attending === "yes") {
                    const { data: newGuest, error: createError } = await supabase
                        .from("guests")
                        .insert({
                            envelope_id: selectedGuest?.envelope_id,
                            name: member.name,
                            guest_type: member.guest_type,
                            whatsapp: member.whatsapp || null,
                        })
                        .select()
                        .single();

                    if (createError) {
                        console.error("Error creating guest:", createError);
                        continue;
                    }
                    member.id = newGuest.id;
                }

                if (member.whatsapp && !member.isNew) {
                    await supabase
                        .from("guests")
                        .update({ whatsapp: member.whatsapp })
                        .eq("id", member.id);
                }

                await supabase.from("rsvp_responses").upsert({
                    wedding_list_id: weddingListId,
                    guest_id: member.id,
                    guest_name: member.name,
                    guest_email: `${member.id}@rsvp.local`, // Kept for backwards compatibility
                    guest_phone: member.whatsapp || null,
                    attending: member.attending,
                    companions: 0,
                    source: rsvpSource,
                    validation_status: rsvpSource === "public_search" ? "pending" : "validated",
                }, { onConflict: "guest_id,wedding_list_id", ignoreDuplicates: false });
            }

            const confirmed = familyMembers.filter((m) => m.attending === "yes");
            setConfirmedCount({
                adults: confirmed.filter((m) => m.guest_type === "adult").length,
                children: confirmed.filter((m) => m.guest_type === "child").length,
            });

            setStep("success");
            showSuccess("Presenças confirmadas!");
        } catch (err) {
            showError("Erro ao salvar. Tente novamente.");
            console.error(err);
        } finally {
            setIsSubmitting(false);
            setPendingSubmission(false);
        }
    };

    // ==================== RENDER ====================


    // Confirm Dialog
    const confirmDialog = (
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center text-xl">
                        ✨ Você é da {groupName}?
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        Confirme para abrir o envelope do seu convite
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-3 justify-center">
                    <Button variant="outline" className="w-full sm:w-auto" onClick={() => setShowConfirmDialog(false)}>
                        Não, buscar outro
                    </Button>
                    <Button onClick={handleConfirmFamily} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white">
                        Sim, sou eu!
                    </Button>
                </DialogFooter>

            </DialogContent>
        </Dialog>
    );

    // Verification Dialog
    const verificationDialog = (
        <Dialog open={showVerifyDialog} onOpenChange={(open) => {
            if (!open) setVerifyingGuest(null);
            setShowVerifyDialog(open);
        }}>
            <DialogContent className="w-[95vw] sm:w-full sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="text-center">🔒 Verificação de Segurança</DialogTitle>
                    <DialogDescription className="text-center">
                        Para confirmar a presença deste convidado, confirme os <b>4 últimos dígitos</b> do número de telefone cadastrado pelo casal.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 flex flex-col items-center gap-4">
                    <div className="flex gap-2 justify-center">
                        <Input
                            className={`w-32 text-center text-2xl tracking-widest ${verificationError ? "border-red-500 bg-red-50" : ""}`}
                            maxLength={4}
                            placeholder="0000"
                            value={verificationDigits}
                            onChange={(e) => {
                                const val = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setVerificationDigits(val);
                                setVerificationError(false);
                            }}
                            autoFocus
                        />
                    </div>
                    {verificationError && (
                        <p className="text-sm text-red-500 font-medium text-center">
                            Dígitos incorretos. <br />Tente novamente ou fale com o casal.
                        </p>
                    )}
                </div>

                <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 justify-center">
                    <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setShowVerifyDialog(false)}>
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleVerifySubmit}
                        disabled={verificationDigits.length !== 4 || isVerifying}
                        className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                    >
                        {isVerifying && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Verificar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );

    // STEP 1: Search
    if (step === "search") {
        return (
            <>
                {confirmDialog}
                {verificationDialog}
                <Card className="max-w-xl mx-auto shadow-lg border-[var(--brand-color-bg)]">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[var(--brand-color-bg)] to-white rounded-full flex items-center justify-center mb-4">
                            <Mail className="w-8 h-8 text-[var(--brand-color)]" />
                        </div>
                        <CardTitle className="text-2xl text-gray-800">Confirmar Presença</CardTitle>
                        <CardDescription className="text-base">
                            Olá! Digite o nome de alguém da sua família para encontrar seu convite.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <Input
                                placeholder="Ex: Carlos, Ana, Família Silva..."
                                value={searchQuery}
                                onChange={(e) => handleSearch(e.target.value)}
                                className="pl-10 h-12 text-lg focus-visible:ring-[var(--brand-color)]"
                                autoFocus
                            />
                            {isSearching && (
                                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 animate-spin" />
                            )}
                        </div>

                        {searchResults.length > 0 && (
                            <div className="space-y-2">
                                {searchResults.map((guest) => (
                                    <button
                                        key={guest.id}
                                        onClick={() => handleSelectGuest(guest)}
                                        className="w-full flex items-center gap-3 p-3 rounded-lg border hover:border-[var(--brand-color)] hover:bg-[var(--brand-color-bg)] transition-all text-left group"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center group-hover:bg-[var(--brand-color-bg)] transition-colors">
                                            {guest.guest_type === "child" ? (
                                                <Baby className="w-5 h-5 text-gray-500 group-hover:text-[var(--brand-color)]" />
                                            ) : (
                                                <User className="w-5 h-5 text-gray-500 group-hover:text-[var(--brand-color)]" />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{guest.name}</p>
                                            <p className="text-sm text-gray-500">{guest.group_name}</p>
                                        </div>
                                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-[var(--brand-color)]" />
                                    </button>
                                ))}
                            </div>
                        )}

                        {searchQuery.length >= 4 && searchResults.length === 0 && !isSearching && (
                            <p className="text-center text-gray-500 py-4">
                                Nenhum resultado encontrado. Verifique a grafia.
                            </p>
                        )}

                        {searchQuery.length > 0 && searchQuery.length < 4 && (
                            <p className="text-center text-gray-400 py-4 text-sm">
                                Digite pelo menos 4 caracteres para buscar
                            </p>
                        )}
                    </CardContent>
                </Card>
            </>
        );
    }

    // STEP 2: RSVP Form
    if (step === "rsvp") {
        return (
            <div className="relative">
                {verificationDialog}
                <Card className="max-w-xl mx-auto shadow-lg border-[var(--brand-color-bg)]">
                    <CardHeader className="text-center pb-4">
                        <div className="mx-auto w-16 h-16 bg-gradient-to-br from-[var(--brand-color-bg)] to-white rounded-full flex items-center justify-center mb-4 animate-in zoom-in duration-300">
                            <Mail className="w-8 h-8 text-[var(--brand-color)]" />
                        </div>
                        <CardTitle className="text-2xl text-gray-800 flex items-center justify-center gap-2">
                            ✉️ {groupName}
                        </CardTitle>
                        <CardDescription>Confirme a presença de cada pessoa</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {isLoadingFamily ? (
                            <div className="text-center py-8">
                                <Loader2 className="w-8 h-8 animate-spin text-[var(--brand-color)] mx-auto" />
                                <p className="text-gray-500 mt-2">Abrindo envelope...</p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {familyMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className={`rounded-lg border p-4 transition-all ${member.attending === "no"
                                                ? "bg-gray-50 opacity-60"
                                                : member.attending === "yes"
                                                    ? "bg-green-50 border-green-200"
                                                    : "bg-white"
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                                                    {member.guest_type === "child" ? (
                                                        <Baby className="w-5 h-5 text-gray-500" />
                                                    ) : (
                                                        <User className="w-5 h-5 text-gray-500" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-800 truncate">
                                                        {member.name}
                                                        {member.isNew && (
                                                            <span className="ml-2 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">
                                                                Novo
                                                            </span>
                                                        )}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        {member.guest_type === "child" ? "Criança" : "Adulto"}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 flex-shrink-0">
                                                    <Button
                                                        size="sm"
                                                        variant={member.attending === "yes" ? "default" : "outline"}
                                                        className={member.attending === "yes" ? "bg-green-500 hover:bg-green-600" : ""}
                                                        onClick={() => toggleAttendance(member.id, "yes")}
                                                    >
                                                        <Check className="w-4 h-4 mr-1" />
                                                        Vou
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant={member.attending === "no" ? "default" : "outline"}
                                                        className={member.attending === "no" ? "bg-gray-500 hover:bg-gray-600" : ""}
                                                        onClick={() => toggleAttendance(member.id, "no")}
                                                    >
                                                        <X className="w-4 h-4 mr-1" />
                                                        Não
                                                    </Button>
                                                </div>
                                            </div>

                                            {member.attending === "yes" && member.guest_type === "adult" && (
                                                <div className="mt-3 pl-13 animate-in slide-in-from-top-2 duration-200">
                                                    <div className="flex items-center gap-2">
                                                        <Phone className="w-4 h-4 text-gray-400" />
                                                        <Input
                                                            placeholder="WhatsApp para lembretes (opcional)"
                                                            value={member.whatsapp}
                                                            onChange={(e) => updateWhatsapp(member.id, e.target.value)}
                                                            className="flex-1 h-9 text-sm focus-visible:ring-[var(--brand-color)]"
                                                            maxLength={15}
                                                        />
                                                    </div>
                                                    <p className="text-xs text-gray-400 mt-1 ml-6">
                                                        Receba o QR Code de acesso e localização
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {!showAddCompanion ? (
                                    <Button
                                        variant="outline"
                                        className="w-full border-dashed"
                                        onClick={() => setShowAddCompanion(true)}
                                    >
                                        <Plus className="w-4 h-4 mr-2" />
                                        Adicionar Acompanhante
                                    </Button>
                                ) : (
                                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-3 animate-in slide-in-from-top-2">
                                        <p className="text-sm font-medium text-yellow-800">Adicionar acompanhante</p>
                                        <Input
                                            placeholder="Nome do acompanhante"
                                            value={newCompanionName}
                                            onChange={(e) => setNewCompanionName(e.target.value)}
                                            autoFocus
                                        />
                                        <Select value={newCompanionType} onValueChange={(v) => setNewCompanionType(v as "adult" | "child")}>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="adult">Adulto</SelectItem>
                                                <SelectItem value="child">Criança</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <div className="flex gap-2">
                                            <Button variant="outline" className="flex-1" onClick={() => setShowAddCompanion(false)}>
                                                Cancelar
                                            </Button>
                                            <Button className="flex-1 bg-yellow-500 hover:bg-yellow-600" onClick={handleAddCompanion}>
                                                Adicionar
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                <Button
                                    className="w-full h-12 text-lg bg-[var(--brand-color)] hover:opacity-90 text-white"
                                    onClick={() => handleSubmit()}
                                    disabled={isSubmitting || familyMembers.every((m) => m.attending === null)}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                            Confirmando...
                                        </>
                                    ) : (
                                        "Confirmar Presenças"
                                    )}
                                </Button>

                                <Button
                                    variant="ghost"
                                    className="w-full"
                                    onClick={() => {
                                        setStep("search");
                                        setFamilyMembers([]);
                                        setSearchQuery("");
                                    }}
                                >
                                    Buscar outro convite
                                </Button>
                            </>
                        )}
                    </CardContent>
                </Card>
                {/* Partial Confirmation Alert */}
                <AlertDialog open={showPartialAlert} onOpenChange={setShowPartialAlert}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Confirmação Parcial</AlertDialogTitle>
                            <AlertDialogDescription>
                                Você deixou {familyMembers.filter(m => m.attending === null).length} pessoas
                                da família "sem resposta". <br /><br />
                                Elas serão marcadas como "pendentes" no sistema.
                                Deseja enviar assim mesmo ou revisar?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Revisar</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={() => {
                                    setPendingSubmission(true);
                                    handleSubmit(true);
                                }}
                                className="bg-green-600 hover:bg-green-700 text-white"
                            >
                                Enviar assim mesmo
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        );
    }

    // STEP 3: Success
    if (step === "success") {
        return (
            <Card className="max-w-xl mx-auto shadow-lg border-[var(--brand-color-bg)]">
                <CardContent className="pt-10 pb-10 text-center space-y-6">
                    <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center animate-in zoom-in duration-500">
                        <PartyPopper className="w-10 h-10 text-green-500" />
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">
                            Obrigado, {selectedGuest?.name.split(" ")[0]}!
                        </h3>
                        <p className="text-gray-600 text-lg">
                            Confirmamos{" "}
                            <span className="font-semibold text-green-600">
                                {confirmedCount.adults} {confirmedCount.adults === 1 ? "adulto" : "adultos"}
                            </span>
                            {confirmedCount.children > 0 && (
                                <>
                                    {" "}e{" "}
                                    <span className="font-semibold text-green-600">
                                        {confirmedCount.children} {confirmedCount.children === 1 ? "criança" : "crianças"}
                                    </span>
                                </>
                            )}
                            {" "}para a {groupName}.
                        </p>
                    </div>

                    <div className="bg-gradient-to-r from-[var(--brand-color-bg)] to-white p-6 rounded-xl border border-[var(--brand-color-bg)]">
                        <Gift className="w-8 h-8 text-[var(--brand-color)] mx-auto mb-3" />
                        <p className="text-gray-700 mb-4">
                            Que tal aproveitar e escolher um presente agora?
                        </p>
                        <Button
                            onClick={() => navigate(weddingSlug ? `/lista/${weddingSlug}` : "/")}
                            className="bg-[var(--brand-color)] hover:opacity-90 text-white"
                        >
                            <Gift className="w-4 h-4 mr-2" />
                            Ver Lista de Presentes
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={() => {
                            if (weddingSlug) {
                                navigate(`/lista/${weddingSlug}?tab=messages`);
                            } else {
                                navigate("/");
                            }
                        }}
                    >
                        <MessageSquare className="w-4 h-4 mr-2" />
                        Deixar recado para o casal
                    </Button>
                </CardContent>
            </Card>
        );
    }

    return null;
};

export default EnvelopeRsvp;

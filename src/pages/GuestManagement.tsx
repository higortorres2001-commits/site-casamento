import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/components/SessionContextProvider";
import { showError, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES } from "@/constants/messages";
import type { Envelope, Guest, WeddingList } from "@/types";
import PageLoader from "@/components/ui/page-loader";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
    Users,
    Plus,
    Search,
    Send,
    Clock,
    CheckCircle,
    AlertCircle,
    Mail,
    ArrowLeft,
    Baby,
    User,
    X,
    FileDown,
    Loader2,
} from "lucide-react";
import WhatsAppIcon from "@/components/ui/whatsapp-icon";

import EnvelopeFormModal from "@/components/guests/EnvelopeFormModal";
import FamilyDetailsModal from "@/components/guests/FamilyDetailsModal";

interface EnvelopeWithGuests extends Envelope {
    guests: Guest[];
}

const GuestManagement = () => {
    const { user } = useSession();
    const navigate = useNavigate();
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [envelopes, setEnvelopes] = useState<EnvelopeWithGuests[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEnvelope, setSelectedEnvelope] = useState<EnvelopeWithGuests | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    const [rsvpData, setRsvpData] = useState<Record<string, { attending: string; validation_status: string }>>({});
    const [isExporting, setIsExporting] = useState(false);
    const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'declined'>('all');

    const loadData = useCallback(async () => {
        if (!user?.id) return;

        try {
            // Get wedding list
            const { data: listData, error: listError } = await supabase
                .from("wedding_lists")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (listError || !listData) {
                showError(ADMIN_MESSAGES.error.LOAD_LIST_FAILED);
                navigate("/dashboard");
                return;
            }

            setWeddingList(listData);

            // Run envelopes and RSVP queries in parallel for better performance
            const [envelopesResult, rsvpResult] = await Promise.all([
                // Get envelopes with guests
                supabase
                    .from("envelopes")
                    .select("*, guests(*), source")
                    .eq("wedding_list_id", listData.id)
                    .order("created_at", { ascending: false }),
                // Get all RSVP responses for this wedding list
                supabase
                    .from("rsvp_responses")
                    .select("guest_id, attending, validation_status")
                    .eq("wedding_list_id", listData.id)
            ]);

            if (envelopesResult.error) throw envelopesResult.error;
            setEnvelopes((envelopesResult.data as EnvelopeWithGuests[]) || []);

            // Build RSVP map
            if (rsvpResult.data) {
                const rsvpMap: Record<string, { attending: string; validation_status: string }> = {};
                rsvpResult.data.forEach((r) => {
                    if (r.guest_id) {
                        rsvpMap[r.guest_id] = {
                            attending: r.attending,
                            validation_status: r.validation_status,
                        };
                    }
                });
                setRsvpData(rsvpMap);
            }
        } catch (error: any) {
            console.error("Error loading data:", error);
            showUserError(ADMIN_MESSAGES.error.LOAD_FAILED, error);
        } finally {
            setLoading(false);
        }
    }, [user, navigate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "sent":
                return (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" /> Enviado
                    </Badge>
                );
            case "failed":
                return (
                    <Badge className="bg-red-100 text-red-700 border-red-200">
                        <AlertCircle className="w-3 h-3 mr-1" /> Falhou
                    </Badge>
                );
            default:
                return (
                    <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                        <Clock className="w-3 h-3 mr-1" /> Pendente
                    </Badge>
                );
        }
    };

    const getGuestStats = (guests: Guest[]) => {
        const adults = guests.filter((g) => g.guest_type === "adult").length;
        const children = guests.filter((g) => g.guest_type === "child").length;
        const withWhatsApp = guests.filter((g) => g.whatsapp).length;
        return { adults, children, withWhatsApp, total: guests.length };
    };

    const getRsvpStats = (guests: Guest[]) => {
        const confirmed = guests.filter((g) => {
            const rsvp = rsvpData[g.id];
            return rsvp?.attending === "yes" && rsvp?.validation_status === "validated";
        }).length;

        const declined = guests.filter((g) => {
            const rsvp = rsvpData[g.id];
            return rsvp?.attending === "no";
        }).length;

        const pending = guests.length - confirmed - declined;

        return { confirmed, declined, pending, total: guests.length };
    };

    // Badge based on RSVP confirmation status (not send status)
    const getRsvpBadge = (guests: Guest[]) => {
        const stats = getRsvpStats(guests);

        if (stats.confirmed === stats.total) {
            return (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" /> Confirmado
                </Badge>
            );
        }

        if (stats.declined === stats.total) {
            return (
                <Badge className="bg-red-100 text-red-700 border-red-200">
                    <X className="w-3 h-3 mr-1" /> Recusado
                </Badge>
            );
        }

        if (stats.confirmed > 0 || stats.declined > 0) {
            return (
                <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200">
                    <Clock className="w-3 h-3 mr-1" /> Parcial
                </Badge>
            );
        }

        return (
            <Badge className="bg-gray-100 text-gray-600 border-gray-200">
                <Clock className="w-3 h-3 mr-1" /> Pendente
            </Badge>
        );
    };

    // Helper to get envelope RSVP status based on guests
    const getEnvelopeRsvpStatus = (guests: Guest[]): 'confirmed' | 'pending' | 'declined' | 'partial' => {
        const stats = getRsvpStats(guests);
        if (stats.confirmed === stats.total) return 'confirmed';
        if (stats.declined === stats.total) return 'declined';
        if (stats.confirmed > 0 || stats.declined > 0) return 'partial';
        return 'pending';
    };

    const filteredEnvelopes = envelopes.filter((env) => {
        // Text search
        const query = searchQuery.toLowerCase();
        const matchesSearch = !query ||
            env.group_name.toLowerCase().includes(query) ||
            env.guests.some((g) => g.name.toLowerCase().includes(query));

        if (!matchesSearch) return false;

        // RSVP status filter
        if (statusFilter === 'all') return true;

        const envelopeStatus = getEnvelopeRsvpStatus(env.guests);

        if (statusFilter === 'confirmed') return envelopeStatus === 'confirmed';
        if (statusFilter === 'declined') return envelopeStatus === 'declined';
        if (statusFilter === 'pending') return envelopeStatus === 'pending' || envelopeStatus === 'partial';

        return true;
    });

    const totalGuests = envelopes.reduce((sum, env) => sum + env.guests.length, 0);
    const totalWithWhatsApp = envelopes.reduce(
        (sum, env) => sum + env.guests.filter((g) => g.whatsapp).length,
        0
    );

    const totalConfirmed = envelopes.reduce((sum, env) => {
        return sum + env.guests.filter(g => {
            const rsvp = rsvpData[g.id];
            return rsvp?.attending === "yes" && rsvp?.validation_status === "validated";
        }).length;
    }, 0);

    // Export guest list to PDF via browser print (dynamic import)
    const handleExportPdf = async () => {
        try {
            setIsExporting(true);
            const { exportGuestListToPDF } = await import("@/utils/exportGuestPDF");
            await exportGuestListToPDF(
                envelopes,
                { totalGuests, totalConfirmed, totalWithWhatsApp },
                rsvpData
            );
        } catch (error) {
            console.error("Export failed", error);
            showError("Erro ao exportar PDF");
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) {
        return <PageLoader message="Carregando convidados..." />;
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b sticky top-0 z-10 transition-all shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigate("/dashboard")}
                                className="-ml-2"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Button>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">
                                    Gestão de Convidados
                                </h1>
                                <p className="text-sm text-gray-500">
                                    {envelopes.length} convites • {totalGuests} convidados
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <Button
                                variant="outline"
                                onClick={handleExportPdf}
                                className="flex-1 md:flex-none"
                                disabled={isExporting}
                            >
                                {isExporting ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <FileDown className="w-4 h-4 mr-2" />
                                )}
                                Exportar
                            </Button>
                            <Button
                                onClick={() => setIsModalOpen(true)}
                                className="bg-pink-500 hover:bg-pink-600 flex-1 md:flex-none"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Novo Convite
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-pink-100 rounded-lg">
                                    <Mail className="w-5 h-5 text-pink-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{envelopes.length}</p>
                                    <p className="text-xs text-gray-500">Convites</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Users className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalGuests}</p>
                                    <p className="text-xs text-gray-500">Convidados</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <WhatsAppIcon className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">{totalWithWhatsApp}</p>
                                    <p className="text-xs text-gray-500">Com WhatsApp</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold">
                                        {totalConfirmed}
                                    </p>
                                    <p className="text-xs text-gray-500">Confirmados</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Search and Filter */}
                <div className="space-y-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            placeholder="Buscar por nome do grupo ou convidado..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10 bg-white"
                        />
                    </div>

                    {/* RSVP Status Filter Tabs */}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant={statusFilter === 'all' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('all')}
                            className={statusFilter === 'all' ? 'bg-pink-500 hover:bg-pink-600' : ''}
                        >
                            Todos
                        </Button>
                        <Button
                            variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('confirmed')}
                            className={statusFilter === 'confirmed' ? 'bg-green-500 hover:bg-green-600' : ''}
                        >
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Confirmados
                        </Button>
                        <Button
                            variant={statusFilter === 'pending' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('pending')}
                            className={statusFilter === 'pending' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                        >
                            <Clock className="w-3 h-3 mr-1" />
                            Pendentes
                        </Button>
                        <Button
                            variant={statusFilter === 'declined' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatusFilter('declined')}
                            className={statusFilter === 'declined' ? 'bg-red-500 hover:bg-red-600' : ''}
                        >
                            <X className="w-3 h-3 mr-1" />
                            Recusados
                        </Button>
                    </div>
                </div>

                {/* Envelope List */}
                {filteredEnvelopes.length === 0 ? (
                    <Card className="border-dashed">
                        <CardContent className="py-12 text-center">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <h3 className="font-medium text-gray-600 mb-2">
                                {envelopes.length === 0
                                    ? "Nenhum convite criado"
                                    : "Nenhum resultado encontrado"}
                            </h3>
                            <p className="text-sm text-gray-400 mb-4">
                                {envelopes.length === 0
                                    ? "Comece adicionando famílias e convidados."
                                    : "Tente buscar por outro nome."}
                            </p>
                            {envelopes.length === 0 && (
                                <Button onClick={() => setIsModalOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Criar Primeiro Convite
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {filteredEnvelopes.map((envelope) => {
                            const stats = getGuestStats(envelope.guests);
                            return (
                                <Card
                                    key={envelope.id}
                                    className="hover:shadow-md transition-shadow cursor-pointer group"
                                    onClick={() => {
                                        setSelectedEnvelope(envelope);
                                        setIsDetailsModalOpen(true);
                                    }}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <CardTitle className="text-lg font-semibold text-gray-800 group-hover:text-pink-600 transition-colors">
                                                {envelope.group_name}
                                            </CardTitle>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!weddingList?.slug || !envelope.slug) return;

                                                        const link = `${window.location.origin}/lista/${weddingList.slug}/rsvp/${envelope.slug}`;
                                                        const text = `Olá ${envelope.group_name}! Confirmem presença no nosso casamento aqui: ${link}`;
                                                        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
                                                    }}
                                                    title="Enviar Link Mágico via WhatsApp"
                                                >
                                                    <WhatsAppIcon className="h-4 w-4" />
                                                </Button>
                                                {getRsvpBadge(envelope.guests)}
                                            </div>
                                        </div>
                                    </CardHeader>
                                    <CardContent>
                                        {/* Guest Pills */}
                                        <div className="flex flex-wrap gap-1 mb-3">
                                            {envelope.guests.slice(0, 4).map((guest) => (
                                                <span
                                                    key={guest.id}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-600"
                                                >
                                                    {guest.guest_type === "child" ? (
                                                        <Baby className="w-3 h-3" />
                                                    ) : (
                                                        <User className="w-3 h-3" />
                                                    )}
                                                    {guest.name.split(" ")[0]}
                                                </span>
                                            ))}
                                            {envelope.guests.length > 4 && (
                                                <span className="px-2 py-0.5 bg-gray-100 rounded-full text-xs text-gray-500">
                                                    +{envelope.guests.length - 4}
                                                </span>
                                            )}
                                        </div>

                                        {/* RSVP Progress Bar */}
                                        {(() => {
                                            const rsvpStats = getRsvpStats(envelope.guests);
                                            const confirmedPct = (rsvpStats.confirmed / rsvpStats.total) * 100;
                                            const declinedPct = (rsvpStats.declined / rsvpStats.total) * 100;
                                            const pendingPct = (rsvpStats.pending / rsvpStats.total) * 100;

                                            return (
                                                <div className="mb-3">
                                                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                                        <span className="text-green-600 font-medium">
                                                            {rsvpStats.confirmed} confirmado{rsvpStats.confirmed !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-gray-400">
                                                            {rsvpStats.pending} pendente{rsvpStats.pending !== 1 ? 's' : ''}
                                                        </span>
                                                        <span className="text-red-600 font-medium">
                                                            {rsvpStats.declined} recusado{rsvpStats.declined !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden flex">
                                                        {/* Green: Confirmed */}
                                                        {confirmedPct > 0 && (
                                                            <div
                                                                className="bg-gradient-to-r from-green-500 to-green-600 transition-all duration-500"
                                                                style={{ width: `${confirmedPct}%` }}
                                                            />
                                                        )}

                                                        {/* Gray: Pending */}
                                                        {pendingPct > 0 && (
                                                            <div
                                                                className="bg-gradient-to-r from-gray-300 to-gray-400 transition-all duration-500"
                                                                style={{ width: `${pendingPct}%` }}
                                                            />
                                                        )}

                                                        {/* Red: Declined */}
                                                        {declinedPct > 0 && (
                                                            <div
                                                                className="bg-gradient-to-r from-red-500 to-red-600 transition-all duration-500"
                                                                style={{ width: `${declinedPct}%` }}
                                                            />
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {/* Stats */}
                                        <div className="flex items-center gap-4 text-xs text-gray-500">
                                            <span className="flex items-center gap-1">
                                                <User className="w-3 h-3" />
                                                {stats.adults}
                                            </span>
                                            {stats.children > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Baby className="w-3 h-3" />
                                                    {stats.children}
                                                </span>
                                            )}
                                            {stats.withWhatsApp > 0 && (
                                                <span className="flex items-center gap-1 text-green-600">
                                                    <WhatsAppIcon className="w-3 h-3" />
                                                    {stats.withWhatsApp}
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Modal */}
            {weddingList && (
                <EnvelopeFormModal
                    open={isModalOpen}
                    onOpenChange={setIsModalOpen}
                    weddingListId={weddingList.id}
                    onSuccess={loadData}
                />
            )}

            {/* Details Modal */}
            {weddingList && selectedEnvelope && (
                <FamilyDetailsModal
                    isOpen={isDetailsModalOpen}
                    onClose={() => setIsDetailsModalOpen(false)}
                    envelope={selectedEnvelope}
                    weddingListId={weddingList.id}
                    weddingListSlug={weddingList.slug}
                    onUpdate={loadData}
                />
            )}
        </div>
    );
};

export default GuestManagement;

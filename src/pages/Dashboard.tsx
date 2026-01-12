import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Heart,
    Gift,
    Users,
    Settings,
    Wallet,
    MessageCircle,
    Copy,
    Check,
    ArrowRight,
    Clock,
    PartyPopper,
    Sparkles,
    Calendar,
    User,
    LogOut,
    ChevronDown,
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES } from "@/constants/messages";
import { generateWhatsAppLink } from "@/utils/phone-formatter";
import type { Profile, WeddingList, Gift as GiftType } from "@/types";
import OnboardingChecklist from "@/components/onboarding/OnboardingChecklist";

// Activity type for the feed
type Activity = {
    id: string;
    type: "gift" | "guest" | "message";
    description: React.ReactNode; // Changed to ReactNode to allow formatting parts of the string
    timestamp: Date;
    amount?: number;
};

const Dashboard = () => {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);
    const [stats, setStats] = useState({
        balance: 0,
        guestsConfirmed: 0,
        guestsTotal: 0,
        giftsNew: 0,
        giftsTotal: 0,
        messagesNew: 0,
    });
    const [activities, setActivities] = useState<Activity[]>([]);
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });
    const navigate = useNavigate();

    useEffect(() => {
        loadData();
    }, []);

    // Update countdown every minute
    useEffect(() => {
        if (!weddingList?.wedding_date) return;

        const updateCountdown = () => {
            // Safe date parsing to avoid timezone issues
            const dateParts = weddingList.wedding_date!.split('T')[0].split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1; // Months are 0-indexed
            const day = parseInt(dateParts[2]);

            let hours = 0;
            let minutes = 0;

            if (weddingList.ceremony_time) {
                const timeParts = weddingList.ceremony_time.split(':');
                hours = parseInt(timeParts[0]);
                minutes = parseInt(timeParts[1]);
            }

            const weddingDate = new Date(year, month, day, hours, minutes);
            const now = new Date();
            const diff = weddingDate.getTime() - now.getTime();

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setCountdown({ days, hours, minutes });
            } else {
                setCountdown({ days: 0, hours: 0, minutes: 0 });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);
        return () => clearInterval(interval);
    }, [weddingList?.wedding_date, weddingList?.ceremony_time]);

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate("/login");
                return;
            }

            // Load profile AND wedding list in parallel
            const [profileResult, listResult] = await Promise.all([
                supabase.from("profiles").select("*").eq("id", user.id).single(),
                supabase.from("wedding_lists").select("*").eq("user_id", user.id).single()
            ]);

            if (profileResult.error) {
                console.error("Profile Error:", profileResult.error);
                // showUserError(ADMIN_MESSAGES.error.LOAD_PROFILE_FAILED, profileResult.error);
                // Continue anyway if possible or handle
            }
            if (profileResult.data) {
                setProfile(profileResult.data);
            }

            const listData = listResult.data;
            setWeddingList(listData);

            // Load stats and activities in parallel if list exists
            if (listData) {
                await Promise.all([
                    loadStats(listData.id),
                    loadActivities(listData.id)
                ]);
            }
        } catch (error: any) {
            showUserError(ADMIN_MESSAGES.error.LOAD_FAILED, error);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadStats = async (listId: string) => {
        // Run all queries in parallel
        const [giftsResult, rsvpResult, messagesResult] = await Promise.all([
            // 1. Gifts Stats
            supabase
                .from("gifts")
                .select("id, price, quantity_purchased")
                .eq("wedding_list_id", listId),

            // 2. RSVP Stats
            supabase
                .from("rsvp_responses")
                .select("*", { count: "exact", head: true })
                .eq("wedding_list_id", listId)
                .eq("attending", "yes")
                .eq("validation_status", "validated"),

            // 3. Messages Stats
            supabase
                .from("guest_messages")
                .select("*", { count: "exact", head: true })
                .eq("wedding_list_id", listId)
        ]);

        // Process Gifts
        let balance = 0;
        let giftsTotal = 0;
        let giftsNew = 0;
        let giftsReceived = 0;

        if (giftsResult.data) {
            balance = giftsResult.data.reduce((sum, g) => sum + (g.price * (g.quantity_purchased || 0)), 0);
            giftsTotal = giftsResult.data.length;
            giftsReceived = giftsResult.data.reduce((sum, g) => sum + (g.quantity_purchased || 0), 0);
            giftsNew = giftsReceived; // Using giftsReceived as primary metric for card
        }

        setStats(prev => ({
            ...prev,
            balance,
            giftsTotal,
            giftsNew, // This is actually Total Items Purchased
            guestsConfirmed: rsvpResult.count || 0,
            messagesNew: messagesResult.count || 0,
        }));
    };

    const loadActivities = async (listId: string) => {
        try {
            // Run all queries in parallel
            const [rsvpsResult, giftsResult, messagesResult] = await Promise.all([
                // 1. RSVPs (Confirmed)
                supabase
                    .from("rsvp_responses")
                    .select("id, guest_name, created_at")
                    .eq("wedding_list_id", listId)
                    .eq("attending", "yes")
                    .order("created_at", { ascending: false })
                    .limit(4),

                // 2. Gifts (Purchased)
                supabase
                    .from("gift_reservations")
                    .select("id, guest_name, created_at, gifts(name, price)")
                    .eq("wedding_list_id", listId) // Ensure filtering by listId
                    .eq("status", "purchased")
                    .order("created_at", { ascending: false })
                    .limit(4),

                // 3. Messages
                supabase
                    .from("guest_messages")
                    .select("id, guest_name, created_at")
                    .eq("wedding_list_id", listId)
                    .order("created_at", { ascending: false })
                    .limit(4)
            ]);

            const newActivities: Activity[] = [];

            // Process RSVPs
            if (rsvpsResult.data) {
                rsvpsResult.data.forEach(rsvp => {
                    const date = new Date(rsvp.created_at);
                    const formattedDate = date.toLocaleDateString('pt-BR');
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    newActivities.push({
                        id: `rsvp-${rsvp.id}`,
                        type: "guest",
                        description: `${rsvp.guest_name} confirmou presença - ${formattedDate} ${formattedTime}`,
                        timestamp: date
                    });
                });
            }

            // Process Gifts
            if (giftsResult.data) {
                giftsResult.data.forEach(giftItem => {
                    const date = new Date(giftItem.created_at);
                    const formattedDate = date.toLocaleDateString('pt-BR');
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    const giftName = (giftItem as any).gifts?.name || "Presente";
                    const price = (giftItem as any).gifts?.price || 0;
                    const netValue = price * 0.95; // 5% fee removed

                    newActivities.push({
                        id: `gift-${giftItem.id}`,
                        type: "gift",
                        description: (
                            <span>
                                <strong>{giftItem.guest_name}</strong> Te Presenteou - {giftName} - <span className="text-green-600 font-medium">R$ {netValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span> (recebido) - {formattedDate} {formattedTime}
                            </span>
                        ),
                        timestamp: date,
                        amount: netValue
                    });
                });
            }

            // Process Messages
            if (messagesResult.data) {
                messagesResult.data.forEach(msg => {
                    const date = new Date(msg.created_at);
                    const formattedDate = date.toLocaleDateString('pt-BR');
                    const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

                    newActivities.push({
                        id: `msg-${msg.id}`,
                        type: "message",
                        description: `${msg.guest_name} deixou uma nova mensagem no mural - ${formattedDate} ${formattedTime}`,
                        timestamp: date
                    });
                });
            }

            // Sort by timestamp descending and take top 4
            const sortedActivities = newActivities
                .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
                .slice(0, 4);

            if (sortedActivities.length > 0) {
                setActivities(sortedActivities);
            } else {
                setActivities([
                    {
                        id: "placeholder",
                        type: "gift",
                        description: "Sua lista está pronta para receber atividades!",
                        timestamp: new Date(),
                    },
                ]);
            }

        } catch (error) {
            console.error("Error loading activities:", error);
        }
    };

    const copyLink = async () => {
        if (!weddingList?.slug) return;
        const link = `${window.location.origin}/lista/${weddingList.slug}`;
        await navigator.clipboard.writeText(link);
        setCopied(true);
        showSuccess(ADMIN_MESSAGES.success.LINK_COPIED);
        setTimeout(() => setCopied(false), 2000);
    };

    const shareWhatsApp = () => {
        if (!weddingList?.slug) return;
        const link = `${window.location.origin}/lista/${weddingList.slug}`;
        const text = `💒 Veja nossa lista de presentes de casamento!\n${weddingList.bride_name} & ${weddingList.groom_name}\n\n${link}`;
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const getTimeAgo = (date: Date) => {
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 60) return `Há ${diffMins} min`;
        if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
        return `Há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
    };

    const getActivityIcon = (type: string) => {
        switch (type) {
            case "gift":
                return <Gift className="h-4 w-4 text-pink-500" />;
            case "guest":
                return <Users className="h-4 w-4 text-green-500" />;
            case "message":
                return <MessageCircle className="h-4 w-4 text-blue-500" />;
            default:
                return <Sparkles className="h-4 w-4 text-purple-500" />;
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Heart className="h-12 w-12 text-pink-500 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-600">Carregando...</p>
                </div>
            </div>
        );
    }

    // No wedding list yet - prompt to create
    if (!weddingList) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-6">
                <div className="max-w-2xl mx-auto">
                    <Card className="border-2 border-pink-200 bg-gradient-to-br from-pink-50 to-white shadow-xl">
                        <CardContent className="pt-8 pb-8 text-center">
                            <div className="bg-pink-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Heart className="h-10 w-10 text-pink-500" />
                            </div>
                            <h1 className="text-3xl font-bold text-gray-800 mb-2">
                                Olá, {profile?.full_name?.split(' ')[0]}! 💍
                            </h1>
                            <p className="text-gray-600 mb-6 text-lg">
                                Vamos criar sua lista de presentes de casamento?
                            </p>
                            <Button
                                onClick={() => navigate("/onboarding")}
                                size="lg"
                                className="bg-pink-500 hover:bg-pink-600 text-white px-8"
                            >
                                <PartyPopper className="h-5 w-5 mr-2" />
                                Criar Minha Lista
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
            {/* Hero Section - Countdown & Link */}
            <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-purple-500 text-white">
                <div className="max-w-6xl mx-auto px-6 py-8">
                    {/* Names & Countdown */}
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-6">
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold mb-1">
                                {weddingList.bride_name} & {weddingList.groom_name}
                            </h1>
                            <p className="text-pink-100 text-sm">Centro de Controle do Casamento</p>
                        </div>

                        {/* User Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" className="bg-white/20 hover:bg-white/30 text-white">
                                    <User className="w-4 h-4 mr-2" />
                                    {profile?.full_name?.split(' ')[0] || 'Minha Conta'}
                                    <ChevronDown className="w-4 h-4 ml-2" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                                <DropdownMenuItem onClick={() => navigate('/meu-perfil')}>
                                    <User className="w-4 h-4 mr-2" />
                                    Meu Perfil
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => navigate('/minha-lista')}>
                                    <Settings className="w-4 h-4 mr-2" />
                                    Configurações
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    onClick={async () => {
                                        await supabase.auth.signOut();
                                        showSuccess('Você saiu da conta!');
                                        navigate('/login');
                                    }}
                                    className="text-red-600 focus:text-red-600"
                                >
                                    <LogOut className="w-4 h-4 mr-2" />
                                    Sair
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>

                        {weddingList.wedding_date && countdown.days > 0 && (
                            <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 text-center">
                                <div className="flex items-center gap-4">
                                    <Clock className="h-6 w-6" />
                                    <div className="flex gap-4">
                                        <div>
                                            <span className="text-4xl font-bold">{countdown.days}</span>
                                            <p className="text-xs text-pink-100">dias</p>
                                        </div>
                                        <div className="text-2xl font-light">:</div>
                                        <div>
                                            <span className="text-4xl font-bold">{countdown.hours}</span>
                                            <p className="text-xs text-pink-100">horas</p>
                                        </div>
                                        <div className="text-2xl font-light">:</div>
                                        <div>
                                            <span className="text-4xl font-bold">{countdown.minutes}</span>
                                            <p className="text-xs text-pink-100">min</p>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-sm mt-2 text-pink-100">para o grande dia! 🎉</p>
                            </div>
                        )}
                    </div>

                    {/* Shareable Link */}
                    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                        <div className="flex flex-col md:flex-row items-center gap-3">
                            <div className="flex-1 w-full">
                                <p className="text-xs text-pink-100 mb-1">Link da sua lista:</p>
                                <div className="bg-white/20 rounded-lg px-4 py-2 font-mono text-sm truncate">
                                    {window.location.origin}/lista/{weddingList.slug}
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={copyLink}
                                    variant="secondary"
                                    className="bg-white text-pink-600 hover:bg-pink-50"
                                >
                                    {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                                    {copied ? "Copiado!" : "Copiar"}
                                </Button>
                                <Button
                                    onClick={shareWhatsApp}
                                    className="bg-green-500 hover:bg-green-600 text-white"
                                >
                                    <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                                    </svg>
                                    WhatsApp
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="max-w-6xl mx-auto px-6 -mt-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Balance Card */}
                    <Card className="shadow-lg hover:shadow-xl transition-shadow border-0">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-green-100 p-2 rounded-lg">
                                    <Wallet className="h-5 w-5 text-green-600" />
                                </div>
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                    Disponível
                                </Badge>
                            </div>
                            <p className="text-3xl font-bold text-gray-800">
                                {formatCurrency(stats.balance)}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Saldo disponível</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full mt-3 text-green-600 border-green-200 hover:bg-green-50"
                            >
                                Solicitar Saque
                            </Button>
                        </CardContent>
                    </Card>

                    {/* Guests Card */}
                    <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 cursor-pointer" onClick={() => navigate("/convidados")}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-blue-100 p-2 rounded-lg">
                                    <Users className="h-5 w-5 text-blue-600" />
                                </div>
                            </div>
                            <p className="text-3xl font-bold text-gray-800">
                                {stats.guestsConfirmed}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Convidados Confirmados</p>
                            <div className="flex items-center text-sm text-blue-500 mt-2">
                                <span>Ver Lista</span>
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Gifts Card */}
                    <Card className="shadow-lg hover:shadow-xl transition-shadow border-0 cursor-pointer" onClick={() => navigate("/meu-perfil?tab=history")}>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-pink-100 p-2 rounded-lg">
                                    <Gift className="h-5 w-5 text-pink-600" />
                                </div>
                                {stats.giftsNew > 0 && (
                                    <Badge className="bg-pink-500 text-white hover:bg-pink-500">
                                        {stats.giftsNew} itens
                                    </Badge>
                                )}
                            </div>
                            <p className="text-3xl font-bold text-gray-800">
                                {stats.giftsNew}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Presentes Recebidos</p>
                            <div className="flex items-center text-sm text-pink-500 mt-2">
                                <span>Ver Extrato</span>
                                <ArrowRight className="h-4 w-4 ml-1" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Messages Card */}
                    <Card className="shadow-lg hover:shadow-xl transition-shadow border-0">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-3">
                                <div className="bg-purple-100 p-2 rounded-lg">
                                    <MessageCircle className="h-5 w-5 text-purple-600" />
                                </div>
                                {stats.messagesNew > 0 && (
                                    <Badge className="bg-purple-500 text-white hover:bg-purple-500">
                                        {stats.messagesNew} novas
                                    </Badge>
                                )}
                            </div>
                            <p className="text-3xl font-bold text-gray-800">
                                {stats.messagesNew}
                            </p>
                            <p className="text-sm text-gray-500 mt-1">Mensagens no mural</p>
                            <p className="text-xs text-gray-400 mt-2">
                                Em breve: mural de recados
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Activity Feed & Quick Actions */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <div className="grid lg:grid-cols-3 gap-6">
                    {/* Activity Feed */}
                    <div className="lg:col-span-2">
                        <Card className="shadow-lg border-0">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <Sparkles className="h-5 w-5 text-pink-500" />
                                    Atividades Recentes
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {activities.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                                        <p>Nenhuma atividade ainda.</p>
                                        <p className="text-sm">Compartilhe sua lista para começar!</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {activities.map((activity) => (
                                            <div
                                                key={activity.id}
                                                className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                                            >
                                                <div className="mt-1">
                                                    {getActivityIcon(activity.type)}
                                                </div>
                                                <div className="flex-1">
                                                    <p className="text-sm text-gray-700">{activity.description}</p>
                                                    {activity.amount && (
                                                        <p className="text-sm font-semibold text-green-600">
                                                            {formatCurrency(activity.amount)}
                                                        </p>
                                                    )}
                                                </div>
                                                <span className="text-xs text-gray-400">
                                                    {getTimeAgo(activity.timestamp)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-4">
                        <Card
                            className="shadow-lg border-0 hover:shadow-xl transition-shadow cursor-pointer group"
                            onClick={() => navigate("/presentes")}
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-pink-100 p-3 rounded-xl group-hover:bg-pink-200 transition-colors">
                                        <Gift className="h-6 w-6 text-pink-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Adicionar Presentes</h3>
                                        <p className="text-sm text-gray-500">Cadastre novos itens</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className="shadow-lg border-0 hover:shadow-xl transition-shadow cursor-pointer group"
                            onClick={() => navigate("/minha-lista")}
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-purple-100 p-3 rounded-xl group-hover:bg-purple-200 transition-colors">
                                        <Settings className="h-6 w-6 text-purple-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Configurar Lista</h3>
                                        <p className="text-sm text-gray-500">Editar informações</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card
                            className="shadow-lg border-0 hover:shadow-xl transition-shadow cursor-pointer group"
                            onClick={() => window.open(`/lista/${weddingList.slug}`, "_blank")}
                        >
                            <CardContent className="pt-6">
                                <div className="flex items-center gap-4">
                                    <div className="bg-blue-100 p-3 rounded-xl group-hover:bg-blue-200 transition-colors">
                                        <Calendar className="h-6 w-6 text-blue-600" />
                                    </div>
                                    <div>
                                        <h3 className="font-semibold text-gray-800">Ver Lista Pública</h3>
                                        <p className="text-sm text-gray-500">Como os convidados veem</p>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-gray-400 ml-auto group-hover:translate-x-1 transition-transform" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;

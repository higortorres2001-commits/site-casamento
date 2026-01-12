"use client";

import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    User,
    Mail,
    Phone,
    Calendar,
    CreditCard,
    History,
    ArrowLeft,
    Loader2,
    Save,
    CheckCircle,
    LogOut,
    Gift,
} from "lucide-react";
import { showSuccess, showError, showUserError } from "@/utils/toast";
import type { Profile as ProfileType } from "@/types";
import Brand from "@/components/Brand";

type PixKeyType = 'telefone' | 'cpf' | 'email' | 'random';

interface Transaction {
    id: string;
    created_at: string;
    gift_name: string;
    guest_name: string;
    amount: number;
    status: string;
}

// Helper for time ago
const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    return `Há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
};

const Profile = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "personal");
    const [filterDays, setFilterDays] = useState<7 | 30 | 60>(7);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<ProfileType | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loadingTransactions, setLoadingTransactions] = useState(false);

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab) {
            setActiveTab(tab);
            if (tab === "history") {
                loadTransactions(filterDays);
            }
        }
    }, [searchParams]);

    // Trigger load when filter changes (if on history tab)
    useEffect(() => {
        if (activeTab === "history") {
            loadTransactions(filterDays);
        }
    }, [filterDays, activeTab]);

    // Form state
    const [fullName, setFullName] = useState("");
    const [birthDate, setBirthDate] = useState("");
    const [email, setEmail] = useState("");
    const [cpf, setCpf] = useState("");
    const [whatsapp, setWhatsapp] = useState("");
    const [pixKeyType, setPixKeyType] = useState<PixKeyType | "">("");
    const [pixKeyValue, setPixKeyValue] = useState("");

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate("/login");
                return;
            }

            const { data: profileData, error } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", user.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error("Error loading profile:", error);
            }

            if (profileData) {
                setProfile(profileData);
                setFullName(profileData.full_name || "");
                setBirthDate(profileData.birth_date || "");
                setEmail(profileData.email || user.email || "");
                setCpf(profileData.cpf || "");
                setWhatsapp(profileData.whatsapp || "");
                setPixKeyType(profileData.pix_key_type || "");
                setPixKeyValue(profileData.pix_key_value || "");
            } else {
                setEmail(user.email || "");
            }

            setLoading(false);
        } catch (err) {
            console.error("Error:", err);
            setLoading(false);
        }
    };

    const loadTransactions = async (days: number = 7) => {
        setLoadingTransactions(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data: weddingList } = await supabase
                .from("wedding_lists")
                .select("id")
                .eq("user_id", user.id)
                .single();

            if (!weddingList) {
                setLoadingTransactions(false);
                return;
            }

            // Calculate date filter
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const { data: orders, error } = await supabase
                .from("orders")
                .select(`
                    id,
                    created_at,
                    amount,
                    status,
                    guest_name,
                    gifts:gift_id (name, price)
                `)
                .eq("wedding_list_id", weddingList.id)
                .gte("created_at", startDate.toISOString())
                .order("created_at", { ascending: false });

            if (error) {
                console.error("Error loading transactions:", error);
            } else {
                const formattedTransactions = orders?.map(order => ({
                    id: order.id,
                    created_at: order.created_at,
                    gift_name: (order.gifts as any)?.name || "Presente",
                    guest_name: order.guest_name || "Anônimo",
                    amount: order.amount,
                    status: order.status,
                })) || [];
                setTransactions(formattedTransactions);
            }
        } catch (err) {
            console.error("Error:", err);
        }
        setLoadingTransactions(false);
    };

    const handleSavePersonalData = async () => {
        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showError("Usuário não encontrado");
                return;
            }

            const { error } = await supabase
                .from("profiles")
                .upsert({
                    id: user.id,
                    full_name: fullName,
                    birth_date: birthDate || null,
                    email: email,
                    cpf: cpf || null,
                    whatsapp: whatsapp || null,
                }, { onConflict: 'id' });

            if (error) throw error;

            showSuccess("Dados pessoais salvos com sucesso!");
        } catch (err: any) {
            showUserError("Erro ao salvar dados", err);
        }
        setSaving(false);
    };

    const handleSavePixKey = async () => {
        if (!pixKeyType) {
            showError("Selecione o tipo da chave PIX");
            return;
        }
        if (!pixKeyValue.trim()) {
            showError("Digite o valor da chave PIX");
            return;
        }

        setSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showError("Usuário não encontrado");
                return;
            }

            const { error } = await supabase
                .from("profiles")
                .upsert({
                    id: user.id,
                    pix_key_type: pixKeyType,
                    pix_key_value: pixKeyValue.trim(),
                }, { onConflict: 'id' });

            if (error) throw error;

            showSuccess("Chave PIX salva com sucesso!");
        } catch (err: any) {
            showUserError("Erro ao salvar chave PIX", err);
        }
        setSaving(false);
    };

    const handleLogout = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            showError("Erro ao sair: " + error.message);
        } else {
            showSuccess("Você saiu da conta com sucesso!");
            navigate("/login");
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const getStatusBadge = (status: string) => {
        const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
            paid: { label: "Pago", variant: "default" },
            pending: { label: "Pendente", variant: "secondary" },
            failed: { label: "Falhou", variant: "destructive" },
            refunded: { label: "Estornado", variant: "outline" },
        };
        const config = statusMap[status] || { label: status, variant: "outline" as const };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-pink-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-8 px-4">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate("/dashboard")}
                        className="text-gray-600"
                    >
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Voltar
                    </Button>
                    <Brand size="md" />
                    <Button
                        variant="outline"
                        onClick={handleLogout}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                    >
                        <LogOut className="w-4 h-4 mr-2" />
                        Sair
                    </Button>
                </div>

                {/* Page Title */}
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        Meu Perfil
                    </h1>
                    <p className="text-gray-500 text-sm">
                        Gerencie seus dados e configurações
                    </p>
                </div>

                {/* Tabs */}
                <Tabs
                    value={activeTab}
                    onValueChange={(val) => {
                        setActiveTab(val);
                        setSearchParams({ tab: val });
                    }}
                    className="w-full"
                >
                    <TabsList className="grid w-full grid-cols-3 mb-6">
                        <TabsTrigger value="personal" className="flex items-center gap-2">
                            <User className="w-4 h-4" />
                            <span className="hidden sm:inline">Dados</span>
                        </TabsTrigger>
                        <TabsTrigger value="pix" className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4" />
                            <span className="hidden sm:inline">Pix</span>
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="flex items-center gap-2"
                            onClick={() => transactions.length === 0 && loadTransactions(filterDays)}
                        >
                            <History className="w-4 h-4" />
                            <span className="hidden sm:inline">Histórico</span>
                        </TabsTrigger>
                    </TabsList>

                    {/* Personal Data Tab */}
                    <TabsContent value="personal">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5 text-pink-500" />
                                    Dados Pessoais
                                </CardTitle>
                                <CardDescription>
                                    Seus dados cadastrais
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <Label htmlFor="fullName" className="flex items-center gap-2">
                                        <User className="w-4 h-4 text-gray-400" />
                                        Nome Completo
                                    </Label>
                                    <Input
                                        id="fullName"
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Seu nome completo"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="birthDate" className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        Data de Nascimento
                                    </Label>
                                    <Input
                                        id="birthDate"
                                        type="date"
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="email" className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-gray-400" />
                                        Email
                                        <Badge variant="outline" className="ml-2 text-green-600 border-green-200">
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            Confirmado
                                        </Badge>
                                    </Label>
                                    <Input
                                        id="email"
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        disabled
                                        className="bg-gray-50"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="cpf" className="flex items-center gap-2">
                                        <CreditCard className="w-4 h-4 text-gray-400" />
                                        CPF
                                    </Label>
                                    <Input
                                        id="cpf"
                                        value={cpf}
                                        onChange={(e) => setCpf(e.target.value)}
                                        placeholder="000.000.000-00"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="whatsapp" className="flex items-center gap-2">
                                        <Phone className="w-4 h-4 text-gray-400" />
                                        WhatsApp
                                    </Label>
                                    <Input
                                        id="whatsapp"
                                        value={whatsapp}
                                        onChange={(e) => setWhatsapp(e.target.value)}
                                        placeholder="(11) 99999-9999"
                                    />
                                </div>

                                <Button
                                    onClick={handleSavePersonalData}
                                    disabled={saving}
                                    className="w-full bg-pink-500 hover:bg-pink-600"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Salvar Dados
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* PIX Tab */}
                    <TabsContent value="pix">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-pink-500" />
                                    Chave PIX
                                </CardTitle>
                                <CardDescription>
                                    Configure sua chave PIX para receber os presentes
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="bg-pink-50 p-4 rounded-lg border border-pink-200">
                                    <p className="text-sm text-pink-800">
                                        💡 Sua chave PIX será usada para receber os valores dos presentes.
                                        Certifique-se de cadastrar uma chave válida.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    <Label>Tipo de Chave</Label>
                                    <Select
                                        value={pixKeyType}
                                        onValueChange={(value) => setPixKeyType(value as PixKeyType)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Selecione o tipo" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="telefone">📱 Telefone</SelectItem>
                                            <SelectItem value="cpf">🪪 CPF</SelectItem>
                                            <SelectItem value="email">📧 Email</SelectItem>
                                            <SelectItem value="random">🔑 Chave Aleatória</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="pixValue">Valor da Chave</Label>
                                    <Input
                                        id="pixValue"
                                        value={pixKeyValue}
                                        onChange={(e) => setPixKeyValue(e.target.value)}
                                        placeholder={
                                            pixKeyType === "telefone" ? "(11) 99999-9999" :
                                                pixKeyType === "cpf" ? "000.000.000-00" :
                                                    pixKeyType === "email" ? "seu@email.com" :
                                                        "Chave aleatória"
                                        }
                                    />
                                </div>

                                <Button
                                    onClick={handleSavePixKey}
                                    disabled={saving}
                                    className="w-full bg-pink-500 hover:bg-pink-600"
                                >
                                    {saving ? (
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4 mr-2" />
                                    )}
                                    Salvar Chave PIX
                                </Button>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* History Tab */}
                    <TabsContent value="history">
                        <Card>
                            <CardHeader>
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <CardTitle className="flex items-center gap-2">
                                            <History className="w-5 h-5 text-pink-500" />
                                            Histórico de Transações
                                        </CardTitle>
                                        <CardDescription>
                                            Veja todos os presentes recebidos
                                        </CardDescription>
                                    </div>

                                    {/* Date Filter Buttons */}
                                    <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-lg">
                                        <button
                                            onClick={() => setFilterDays(7)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterDays === 7
                                                    ? "bg-white text-pink-600 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-900"
                                                }`}
                                        >
                                            7 dias
                                        </button>
                                        <button
                                            onClick={() => setFilterDays(30)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterDays === 30
                                                    ? "bg-white text-pink-600 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-900"
                                                }`}
                                        >
                                            30 dias
                                        </button>
                                        <button
                                            onClick={() => setFilterDays(60)}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${filterDays === 60
                                                    ? "bg-white text-pink-600 shadow-sm"
                                                    : "text-gray-500 hover:text-gray-900"
                                                }`}
                                        >
                                            60 dias
                                        </button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                {loadingTransactions ? (
                                    <div className="flex justify-center py-8">
                                        <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
                                    </div>
                                ) : transactions.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                                        <div className="bg-gray-100 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                                            <History className="w-6 h-6 text-gray-400" />
                                        </div>
                                        <p className="text-gray-600 font-medium">Nenhum presente encontrado no período</p>
                                        <p className="text-sm text-gray-400 mt-1">
                                            Tente filtrar por um período maior
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {transactions.map((tx) => (
                                            <div
                                                key={tx.id}
                                                className="flex items-start gap-3 p-4 rounded-xl border border-gray-100 hover:border-pink-100 hover:bg-pink-50/30 transition-all group bg-white shadow-sm"
                                            >
                                                {/* Icon */}
                                                <div className="bg-pink-100 p-2.5 rounded-full shrink-0 mt-1 group-hover:bg-pink-200 transition-colors">
                                                    <Gift className="h-5 w-5 text-pink-600" />
                                                </div>

                                                {/* Content */}
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-start gap-2">
                                                        <div>
                                                            <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                                                Passaram a gravata - {tx.gift_name}
                                                            </p>
                                                            <p className="text-sm text-gray-600 mt-0.5">
                                                                <span className="font-semibold text-gray-800">{tx.guest_name}</span> te presenteou
                                                            </p>
                                                        </div>
                                                        <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                                                            {getTimeAgo(tx.created_at)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between mt-2">
                                                        <div className="flex items-center gap-2">
                                                            {/* Status Badge */}
                                                            {getStatusBadge(tx.status)}
                                                        </div>
                                                        <p className="text-sm font-bold text-green-600 bg-green-50 px-2 py-1 rounded-md border border-green-100">
                                                            {formatCurrency(tx.amount)}
                                                        </p>
                                                    </div>

                                                    {/* Full Date Tooltip/Text */}
                                                    <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
                                                        <Calendar className="w-3 h-3" />
                                                        {formatDate(tx.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Footer */}
                <p className="text-center text-xs text-gray-400 mt-8">
                    © 2025 DuetLove. Todos os direitos reservados.
                </p>
            </div>
        </div>
    );
};

export default Profile;

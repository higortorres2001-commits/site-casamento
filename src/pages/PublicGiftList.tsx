import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Heart,
    Gift,
    ShoppingBag,
    Sparkles,
    AlertCircle,
    MessageSquare,
    CalendarCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { WeddingList, Gift as GiftType } from "@/types";
import EnvelopeRsvp from "@/components/public/EnvelopeRsvp";
import MessageWall from "@/components/public/MessageWall";
import CoupleHero from "@/components/public/CoupleHero";
import CoupleStory from "@/components/public/CoupleStory";
import { UI_MESSAGES } from "@/constants/messages";
import { updateMetaTags } from "@/utils/seo";
import { hexToRgba } from "@/utils/colors";

const CATEGORIES = [
    { value: "all", label: "Todos" },
    { value: "cozinha", label: "🍳 Cozinha" },
    { value: "quarto", label: "🛏️ Quarto" },
    { value: "banheiro", label: "🛁 Banheiro" },
    { value: "sala", label: "🛋️ Sala" },
    { value: "decoracao", label: "🎨 Decoração" },
    { value: "eletrodomesticos", label: "⚡ Eletrodomésticos" },
    { value: "eletronicos", label: "📱 Eletrônicos" },
    { value: "luademel", label: "✈️ Lua de Mel" },
    { value: "experiencias", label: "🎭 Experiências" },
    { value: "outros", label: "📦 Outros" },
];

const PublicGiftList = () => {
    const { slug } = useParams<{ slug: string }>();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [activeTab, setActiveTab] = useState("home");

    useEffect(() => {
        const tab = searchParams.get("tab");
        if (tab && ["home", "gifts", "rsvp", "messages"].includes(tab)) {
            setActiveTab(tab);
        }
    }, [searchParams]);

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        setSearchParams({ tab: value }, { replace: true });
    };
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [gifts, setGifts] = useState<GiftType[]>([]);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0 });

    useEffect(() => {
        loadData();
    }, [slug]);

    // Update countdown
    useEffect(() => {
        if (!weddingList?.wedding_date) return;

        const updateCountdown = () => {
            const weddingDate = new Date(weddingList.wedding_date!);
            const now = new Date();
            const diff = weddingDate.getTime() - now.getTime();

            if (diff > 0) {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                setCountdown({ days, hours, minutes });
            }
        };

        updateCountdown();
        const interval = setInterval(updateCountdown, 60000);
        return () => clearInterval(interval);
    }, [weddingList?.wedding_date]);

    const loadData = async () => {
        if (!slug) {
            setNotFound(true);
            setLoading(false);
            return;
        }

        try {
            // Load wedding list AND gifts in a single optimized query
            const { data: listData, error: listError } = await supabase
                .from("wedding_lists")
                .select("*, gifts(*)")
                .eq("slug", slug)
                .single();

            if (listError || !listData) {
                setNotFound(true);
                setLoading(false);
                return;
            }

            // Extract gifts from the joined query
            // @ts-ignore - Supabase join types can be tricky
            const loadedGifts = (listData.gifts || []) as GiftType[];

            // Sort gifts manually since we can't easily order joined relations in a single query without complex syntax
            const sortedGifts = loadedGifts.sort((a, b) => {
                // PrioritySort: high > medium > low
                const priorityMap = { high: 0, medium: 1, low: 2 };
                if (priorityMap[a.priority] !== priorityMap[b.priority]) {
                    return priorityMap[a.priority] - priorityMap[b.priority];
                }
                // DateSort: Newest first
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });

            setWeddingList(listData);
            setGifts(sortedGifts);

            // Update SEO Tags (non-blocking)
            updateMetaTags({
                title: `Lista de Casamento - ${listData.bride_name} & ${listData.groom_name}`,
                description: listData.description || `Confirme sua presença e veja a lista de presentes de ${listData.bride_name} e ${listData.groom_name}.`,
                url: window.location.href,
            });

        } catch (error) {
            console.error("Error loading data:", error);
            setNotFound(true);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return new Intl.DateTimeFormat("pt-BR", {
            day: "numeric",
            month: "long",
            year: "numeric",
        }).format(date);
    };

    const getAvailableQuantity = (gift: GiftType) => {
        return gift.quantity_total - (gift.quantity_reserved || 0) - (gift.quantity_purchased || 0);
    };

    const getTotalCollected = (gift: GiftType) => {
        return gift.price * (gift.quantity_purchased || 0);
    };

    const getProgressPercent = (gift: GiftType) => {
        if (gift.quantity_total <= 1) return 0;
        const total = gift.price * gift.quantity_total;
        const collected = getTotalCollected(gift);
        return Math.min((collected / total) * 100, 100);
    };

    const isCotas = (gift: GiftType) => {
        return gift.is_quota || false;
    };

    const isSoldOut = (gift: GiftType) => {
        return getAvailableQuantity(gift) <= 0;
    };

    const handlePresentear = (gift: GiftType) => {
        // Navigate to gift checkout
        navigate(`/presente/${gift.id}`);
    };

    const filteredGifts = gifts.filter(
        (gift) => selectedCategory === "all" || gift.category === selectedCategory
    );

    // Calculate Brand Colors
    const brandColor = weddingList?.brand_color || "#ec4899"; // Default Pink-500
    const brandColorBg = hexToRgba(brandColor, 0.1);

    const cssVariables = {
        "--brand-color": brandColor,
        "--brand-color-bg": brandColorBg,
    } as React.CSSProperties;

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Heart className="h-12 w-12 text-pink-500 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-600">{UI_MESSAGES.loading.GIFT_LIST}</p>
                </div>
            </div>
        );
    }

    if (notFound || !weddingList) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-6">
                <Card className="max-w-md w-full text-center p-8">
                    <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">
                        {UI_MESSAGES.notFound.LIST_TITLE}
                    </h1>
                    <p className="text-gray-600 mb-6">
                        {UI_MESSAGES.notFound.LIST_DESCRIPTION}
                    </p>
                    <Button onClick={() => navigate("/")} variant="outline">
                        {UI_MESSAGES.notFound.BACK_HOME}
                    </Button>
                </Card>
            </div>
        );
    }

    return (
        <div
            className="min-h-screen bg-gradient-to-br from-[var(--brand-color-bg)] via-white to-[var(--brand-color-bg)]"
            style={cssVariables}
        >
            {/* Hero Section (Always visible) */}
            <CoupleHero weddingList={weddingList} />

            {/* Navigation Tabs */}
            <div className="max-w-6xl mx-auto px-3 sm:px-6 -mt-8 relative z-20">
                <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                    <TabsList className="w-full h-auto p-1 bg-white/95 backdrop-blur shadow-lg rounded-xl mb-8 flex flex-col sm:flex-row gap-1">
                        <TabsTrigger
                            value="home"
                            className="flex-1 py-3 text-base data-[state=active]:bg-[var(--brand-color-bg)] data-[state=active]:text-[var(--brand-color)] transition-all font-medium"
                        >
                            <Sparkles className="w-4 h-4 mr-2" />
                            Início
                        </TabsTrigger>
                        <TabsTrigger
                            value="gifts"
                            className="flex-1 py-3 text-base data-[state=active]:bg-[var(--brand-color-bg)] data-[state=active]:text-[var(--brand-color)] transition-all font-medium"
                        >
                            <Gift className="w-4 h-4 mr-2" />
                            Lista de Presentes
                        </TabsTrigger>
                        <TabsTrigger
                            value="rsvp"
                            className="flex-1 py-3 text-base data-[state=active]:bg-[var(--brand-color-bg)] data-[state=active]:text-[var(--brand-color)] transition-all font-medium"
                        >
                            <CalendarCheck className="w-4 h-4 mr-2" />
                            Confirmar Presença
                        </TabsTrigger>
                        <TabsTrigger
                            value="messages"
                            className="flex-1 py-3 text-base data-[state=active]:bg-[var(--brand-color-bg)] data-[state=active]:text-[var(--brand-color)] transition-all font-medium"
                        >
                            <MessageSquare className="w-4 h-4 mr-2" />
                            Mural de Recados
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="home" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <CoupleStory weddingList={weddingList} />
                    </TabsContent>

                    <TabsContent value="gifts" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Category Filter */}
                        {(() => {
                            // Calculate available categories dynamically
                            const usedCategories = new Set(gifts.map(g => g.category).filter(Boolean));

                            // Always include 'all', filter others based on usage
                            const availableCategories = CATEGORIES.filter(
                                cat => cat.value === "all" || usedCategories.has(cat.value)
                            );

                            // Hide filter bar if only "all" category is available (meaning no categorized gifts)
                            if (availableCategories.length <= 1) return null;

                            return (
                                <div className="mb-8 overflow-x-auto pb-4 -mx-4 px-4 md:overflow-visible md:pb-0 md:px-0">
                                    <Card className="border-[var(--brand-color-bg)] shadow-sm bg-white/80 backdrop-blur min-w-max md:min-w-0">
                                        <CardContent className="p-2">
                                            <div className="flex gap-2">
                                                {availableCategories.map((cat) => (
                                                    <Button
                                                        key={cat.value}
                                                        variant={selectedCategory === cat.value ? "default" : "ghost"}
                                                        onClick={() => setSelectedCategory(cat.value)}
                                                        className={`rounded-full transition-all ${selectedCategory === cat.value
                                                            ? "bg-[var(--brand-color)] hover:opacity-90 shadow-md transform scale-105 text-white"
                                                            : "hover:bg-[var(--brand-color-bg)] text-gray-600"
                                                            }`}
                                                    >
                                                        {cat.label}
                                                    </Button>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>
                            );
                        })()}

                        {/* Gifts Grid */}
                        <div className="space-y-8">
                            {filteredGifts.length === 0 ? (
                                <div className="text-center py-12 bg-white/50 rounded-2xl border border-dashed border-gray-200">
                                    <Gift className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                                    <p className="text-gray-500">
                                        {gifts.length === 0
                                            ? UI_MESSAGES.emptyState.NO_GIFTS_YET
                                            : UI_MESSAGES.emptyState.NO_GIFTS_CATEGORY}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                                    {filteredGifts.map((gift) => (
                                        <Card
                                            key={gift.id}
                                            className={`flex flex-col h-full overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 group ${isSoldOut(gift) ? "opacity-60" : ""
                                                }`}
                                        >
                                            {/* Image */}
                                            <div className="aspect-square bg-gradient-to-br from-[var(--brand-color-bg)] to-white relative overflow-hidden flex-shrink-0">
                                                {gift.image_url ? (
                                                    <img
                                                        src={`${gift.image_url}?width=400&height=400&resize=cover&quality=75`}
                                                        alt={gift.name}
                                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full flex flex-col items-center justify-center text-[var(--brand-color)] opacity-50">
                                                        <Gift className="h-16 w-16" />
                                                    </div>
                                                )}

                                                {/* Category Badge */}
                                                {gift.category && (
                                                    <Badge className="absolute top-3 left-3 bg-white/90 text-gray-700 shadow-sm">
                                                        {CATEGORIES.find((c) => c.value === gift.category)?.label.split(" ")[0] || gift.category}
                                                    </Badge>
                                                )}

                                                {/* Priority Badge - Only for High Priority */}
                                                {gift.priority === 'high' && (
                                                    <Badge className="absolute top-3 right-3 bg-rose-500 text-white shadow-sm border-0 animate-pulse">
                                                        ❤️ Mais Desejado
                                                    </Badge>
                                                )}

                                                {/* Sold Out Badge */}
                                                {isSoldOut(gift) && (
                                                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                                        <Badge className="bg-gray-800 text-white text-lg px-4 py-2">
                                                            Esgotado 🎉
                                                        </Badge>
                                                    </div>
                                                )}

                                                {/* Cotas Badge */}
                                                {isCotas(gift) && !isSoldOut(gift) && (
                                                    <Badge className="absolute top-3 right-3 bg-green-500 text-white shadow-sm">
                                                        Cotas
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Content */}
                                            <div className="p-4 flex flex-col flex-1">
                                                <h3 className="font-semibold text-lg text-gray-800 mb-1 line-clamp-2">
                                                    {gift.name}
                                                </h3>

                                                {gift.description && (
                                                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                                        {gift.description}
                                                    </p>
                                                )}

                                                {/* Progress Bar for Cotas */}
                                                {isCotas(gift) && (
                                                    <div className="mb-3">
                                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                            <span>{formatCurrency(getTotalCollected(gift))} arrecadados</span>
                                                            <span>{formatCurrency(gift.price * gift.quantity_total)}</span>
                                                        </div>
                                                        <Progress value={getProgressPercent(gift)} className="h-2" />
                                                        <p className="text-xs text-center text-gray-400 mt-1">
                                                            {gift.quantity_purchased || 0} de {gift.quantity_total} cotas
                                                        </p>
                                                    </div>
                                                )}

                                                {/* Price & Action */}
                                                <div className="flex items-center justify-between mt-auto pt-4">
                                                    <span className="text-2xl font-bold text-[var(--brand-color)]">
                                                        {formatCurrency(gift.price)}
                                                    </span>

                                                    {!isSoldOut(gift) && (
                                                        <Button
                                                            onClick={() => handlePresentear(gift)}
                                                            className="bg-[var(--brand-color)] hover:opacity-90 text-white"
                                                        >
                                                            <ShoppingBag className="h-4 w-4 mr-2" />
                                                            Presentear
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Available quantity for non-cotas (Hide if unlimited/large stock) */}
                                                {!isCotas(gift) && !isSoldOut(gift) && gift.quantity_total > 1 && gift.quantity_total < 100 && (
                                                    <p className="text-xs text-gray-400 text-center mt-2">
                                                        {getAvailableQuantity(gift)} disponível(eis)
                                                    </p>
                                                )}
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="rsvp" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="py-4">
                            <EnvelopeRsvp weddingListId={weddingList.id} weddingSlug={weddingList.slug} />
                        </div>
                    </TabsContent>

                    <TabsContent value="messages" className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="py-4">
                            <MessageWall weddingListId={weddingList.id} />
                        </div>
                    </TabsContent>
                </Tabs>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 border-t py-8 text-center mt-12">
                <p className="text-gray-500 text-sm">
                    Lista de presentes de {weddingList.bride_name} & {weddingList.groom_name}
                </p>
                <p className="text-gray-400 text-xs mt-1">
                    Feito com ❤️ para o casal
                </p>
            </div>
        </div>
    );
};

export default PublicGiftList;

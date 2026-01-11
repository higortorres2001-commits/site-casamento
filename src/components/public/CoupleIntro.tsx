import React, { useEffect, useState } from "react";
import {
    Heart,
    Calendar,
    MapPin,
    Navigation,
    Clock,
    Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    CarouselNext,
    CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import type { WeddingList } from "@/types";

interface CoupleIntroProps {
    weddingList: WeddingList;
}

const CoupleIntro: React.FC<CoupleIntroProps> = ({ weddingList }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!weddingList.wedding_date) return;

        const interval = setInterval(() => {
            const weddingDate = new Date(weddingList.wedding_date!);
            const now = new Date();
            const diff = weddingDate.getTime() - now.getTime();

            if (diff > 0) {
                setTimeLeft({
                    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                    hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                    minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
                    seconds: Math.floor((diff % (1000 * 60)) / 1000),
                });
            } else {
                setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [weddingList.wedding_date]);

    const openMap = (location: string) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
    };

    const hasEvents = weddingList.ceremony_location_name || weddingList.party_location_name;

    // Determine cover image
    const coverImage = window.innerWidth >= 768
        ? (weddingList.cover_image_desktop || weddingList.cover_image_mobile)
        : (weddingList.cover_image_mobile || weddingList.cover_image_desktop);

    return (
        <div className="space-y-16 pb-10">
            {/* Header: Hero Section with Cover Image */}
            <div className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
                {/* Background Image */}
                {coverImage ? (
                    <div
                        className="absolute inset-0 bg-cover bg-center bg-no-repeat transform scale-105"
                        style={{ backgroundImage: `url(${coverImage})` }}
                    />
                ) : (
                    // Default Gradient if no image
                    <div className="absolute inset-0 bg-gradient-to-r from-pink-400 via-rose-400 to-purple-400 opacity-90" />
                )}

                {/* Black Overlay Gradient - Only if image exists */}
                {coverImage && <div className="absolute inset-0 bg-black/50" />}

                {/* Content */}
                <div className={`relative z-10 text-center space-y-8 max-w-4xl mx-auto px-6 animate-fade-in ${coverImage ? 'text-white' : 'text-white'}`}>
                    <div className="flex flex-col md:flex-row items-center justify-center gap-4">
                        <h1 className={`text-6xl md:text-8xl font-cursive leading-tight drop-shadow-lg ${coverImage ? 'opacity-90' : 'text-white drop-shadow-md'}`}>
                            {weddingList.bride_name?.split(' ')[0]}
                        </h1>
                        <div className="relative">
                            <Heart className={`h-12 w-12 animate-pulse ${coverImage ? 'text-white/80 fill-white/20' : 'text-white fill-white/20'}`} />
                        </div>
                        <h1 className={`text-6xl md:text-8xl font-cursive leading-tight drop-shadow-lg ${coverImage ? 'opacity-90' : 'text-white drop-shadow-md'}`}>
                            {weddingList.groom_name?.split(' ')[0]}
                        </h1>
                    </div>

                    <div className={`flex items-center justify-center gap-4 uppercase tracking-[0.2em] text-sm font-medium ${coverImage ? 'text-white/80' : 'text-white/90'}`}>
                        <span className={`h-[1px] w-12 ${coverImage ? 'bg-white/50' : 'bg-white/60'}`}></span>
                        <span>Save The Date</span>
                        <span className={`h-[1px] w-12 ${coverImage ? 'bg-white/50' : 'bg-white/60'}`}></span>
                    </div>

                    {weddingList.wedding_date && (
                        <div className={`inline-grid grid-cols-4 gap-6 p-6 backdrop-blur-md rounded-2xl border shadow-2xl ${coverImage ? 'bg-white/10 border-white/20' : 'bg-white/20 border-white/30'}`}>
                            {[
                                { label: "Dias", value: timeLeft.days },
                                { label: "Horas", value: timeLeft.hours },
                                { label: "Min", value: timeLeft.minutes },
                                { label: "Seg", value: timeLeft.seconds },
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col items-center min-w-[60px]">
                                    <span className="text-3xl md:text-5xl font-bold text-white tabular-nums drop-shadow-md">
                                        {String(item.value).padStart(2, '0')}
                                    </span>
                                    <span className={`text-[10px] md:text-xs uppercase tracking-wider mt-1 font-semibold ${coverImage ? 'text-white/80' : 'text-white/90'}`}>
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Couple Story & Carousel */}
            {(weddingList.couple_story || (weddingList.gallery_images && weddingList.gallery_images.length > 0)) && (
                <div className="grid md:grid-cols-2 gap-12 items-center bg-white p-6 md:p-12 rounded-3xl shadow-sm border border-gray-100">
                    <div className="space-y-6">
                        <h2 className="text-3xl md:text-4xl font-cursive text-gray-800">Nossa História</h2>
                        <div className="prose prose-pink text-gray-600 leading-relaxed whitespace-pre-line text-lg">
                            {weddingList.couple_story || "Escreva a história do casal aqui..."}
                        </div>
                    </div>

                    {weddingList.gallery_images && weddingList.gallery_images.length > 0 && (
                        <Carousel className="w-full max-w-md mx-auto">
                            <CarouselContent>
                                {weddingList.gallery_images.map((img, idx) => (
                                    <CarouselItem key={idx}>
                                        <div className="p-1">
                                            <Card className="overflow-hidden border-4 border-white shadow-lg rotate-1">
                                                <CardContent className="flex aspect-[4/3] items-center justify-center p-0">
                                                    <img
                                                        src={img}
                                                        alt={`Foto ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </CarouselItem>
                                ))}
                            </CarouselContent>
                            <CarouselPrevious />
                            <CarouselNext />
                        </Carousel>
                    )}
                </div>
            )}

            {/* Event Details */}
            {(weddingList.ceremony_location_name || weddingList.has_party) && (
                <div className="grid md:grid-cols-2 gap-8">
                    {/* Ceremony */}
                    {weddingList.ceremony_location_name && (
                        <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
                            <div className="h-64 overflow-hidden relative">
                                {weddingList.ceremony_image ? (
                                    <img
                                        src={weddingList.ceremony_image}
                                        alt="Cerimônia"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-blue-50 flex items-center justify-center text-blue-300">
                                        <MapPin className="h-16 w-16" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm font-bold text-blue-600 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                                    Cerimônia
                                </div>
                            </div>
                            <CardContent className="p-6 text-center space-y-4">
                                <h3 className="text-2xl font-bold text-gray-800">{weddingList.ceremony_location_name}</h3>

                                <div className="space-y-1 text-gray-600">
                                    {weddingList.ceremony_address && <p>{weddingList.ceremony_address}</p>}

                                    {(weddingList.wedding_date || weddingList.ceremony_time) && (
                                        <div className="flex flex-col items-center justify-center gap-1 text-sm text-gray-500 mt-3 pt-3 border-t w-full">
                                            {weddingList.wedding_date && (
                                                <p className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4" />
                                                    {new Date(weddingList.wedding_date).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                            {weddingList.ceremony_time && (
                                                <p className="flex items-center gap-2 font-medium text-blue-600">
                                                    <Clock className="h-4 w-4" />
                                                    {weddingList.ceremony_time}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full mt-4 gap-2 hover:bg-blue-50 hover:text-blue-600 border-blue-100"
                                    onClick={() => openMap(weddingList.ceremony_address || weddingList.ceremony_location_name || "")}
                                >
                                    <Map className="h-4 w-4" />
                                    Mapear Rota
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* Party - Only show if has_party is true */}
                    {weddingList.has_party && (
                        <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
                            <div className="h-64 overflow-hidden relative">
                                {weddingList.party_image ? (
                                    <img
                                        src={weddingList.party_image}
                                        alt="Festa"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-orange-50 flex items-center justify-center text-orange-300">
                                        <Navigation className="h-16 w-16" />
                                    </div>
                                )}
                                <div className="absolute top-4 left-4 bg-white/90 px-3 py-1 rounded-full text-sm font-bold text-orange-600 shadow-sm flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse"></div>
                                    Festa
                                </div>
                            </div>
                            <CardContent className="p-6 text-center space-y-4">
                                <h3 className="text-2xl font-bold text-gray-800">{weddingList.party_location_name || "A Definir"}</h3>

                                <div className="space-y-1 text-gray-600">
                                    {weddingList.party_address && <p>{weddingList.party_address}</p>}

                                    {(weddingList.party_date || weddingList.party_time) && (
                                        <div className="flex flex-col items-center justify-center gap-1 text-sm text-gray-500 mt-3 pt-3 border-t w-full">
                                            {weddingList.party_date && (
                                                <p className="flex items-center gap-2">
                                                    <Calendar className="h-4 w-4" />
                                                    {new Date(weddingList.party_date).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                            {weddingList.party_time && (
                                                <p className="flex items-center gap-2 font-medium text-orange-600">
                                                    <Clock className="h-4 w-4" />
                                                    {weddingList.party_time}
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <Button
                                    variant="outline"
                                    className="w-full mt-4 gap-2 hover:bg-orange-50 hover:text-orange-600 border-orange-100"
                                    onClick={() => openMap(weddingList.party_address || weddingList.party_location_name || "")}
                                >
                                    <Map className="h-4 w-4" />
                                    Mapear Rota
                                </Button>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}
        </div>
    );
};

export default CoupleIntro;

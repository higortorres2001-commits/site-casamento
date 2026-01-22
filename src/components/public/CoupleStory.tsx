import React, { useEffect, useState } from "react";
import {
    Calendar,
    MapPin,
    Navigation,
    Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Carousel,
    CarouselContent,
    CarouselItem,
    type CarouselApi,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";
import type { WeddingList } from "@/types";
import { formatDateBR } from "@/utils/date";

interface CoupleStoryProps {
    weddingList: WeddingList;
}

const CoupleStory: React.FC<CoupleStoryProps> = ({ weddingList }) => {
    const [api, setApi] = useState<CarouselApi>();
    const [current, setCurrent] = useState(0);
    const [count, setCount] = useState(0);

    useEffect(() => {
        if (!api) return;

        setCount(api.scrollSnapList().length);
        setCurrent(api.selectedScrollSnap() + 1);

        api.on("select", () => {
            setCurrent(api.selectedScrollSnap() + 1);
        });
    }, [api]);

    const openMap = (location: string) => {
        window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`, '_blank');
    };

    return (
        <div className="space-y-0 pb-12 animate-in fade-in duration-1000">
            {/* Full Width Carousel Section */}
            {(weddingList.gallery_images && weddingList.gallery_images.length > 0) ? (
                <section className="relative w-full">
                    <Carousel setApi={setApi} className="w-full">
                        <CarouselContent>
                            {weddingList.gallery_images.map((img, idx) => (
                                <CarouselItem key={idx} className="pl-0">
                                    <div className="relative w-full h-[50vh] md:h-[80vh]">
                                        <img
                                            src={img}
                                            alt={`Foto ${idx + 1}`}
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                        <div className="absolute inset-0 bg-black/20" />
                                    </div>
                                </CarouselItem>
                            ))}
                        </CarouselContent>

                        {/* Dots Indicator */}
                        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-2 z-10">
                            {Array.from({ length: count }).map((_, index) => (
                                <button
                                    key={index}
                                    className={cn(
                                        "h-2.5 transition-all rounded-full shadow-sm",
                                        current === index + 1
                                            ? "w-8 bg-white"
                                            : "w-2.5 bg-white/50 hover:bg-white/70"
                                    )}
                                    onClick={() => api?.scrollTo(index)}
                                    aria-label={`Ir para foto ${index + 1}`}
                                />
                            ))}
                        </div>
                    </Carousel>
                </section>
            ) : null}

            {/* Story Text Section */}
            {weddingList.couple_story?.trim() && (
                <section className="max-w-4xl mx-auto px-6 py-20 text-center space-y-8">
                    <div className="inline-block border-b-2 border-pink-300 pb-1">
                        <span className="text-sm font-medium tracking-widest uppercase text-gray-500">Sobre Nós</span>
                    </div>
                    <h2 className="text-5xl md:text-6xl font-cursive text-gray-900 leading-tight">
                        Nossa História
                    </h2>
                    <div className="prose prose-lg text-gray-600 leading-relaxed font-light text-lg mx-auto">
                        <p className="whitespace-pre-line">{weddingList.couple_story}</p>
                    </div>
                </section>
            )}

            {/* Event Details Section */}
            {(weddingList.ceremony_location_name || weddingList.has_party) && (
                <section className="bg-gray-50/50 py-20 px-4 md:px-8">
                    <div className="max-w-5xl mx-auto space-y-16">
                        <div className="text-center space-y-4">
                            <h2 className="text-4xl md:text-5xl font-cursive text-gray-900">O Grande Dia</h2>
                            <p className="text-gray-500 uppercase tracking-widest text-sm">Detalhes dos Eventos</p>
                        </div>

                        {/* Dress Code Section - Only show if filled */}
                        {weddingList.dress_code?.trim() && (
                            <div className="max-w-md mx-auto bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 bg-pink-50 rounded-full mb-4">
                                    <svg className="w-6 h-6 text-pink-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
                                    </svg>
                                </div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Traje</h3>
                                <p className="text-gray-600 text-lg">{weddingList.dress_code}</p>
                            </div>
                        )}

                        {(() => {
                            // Check if Ceremony and Party are effectively the same event
                            const isSameLocation =
                                weddingList.has_party &&
                                weddingList.ceremony_location_name &&
                                weddingList.party_location_name &&
                                weddingList.ceremony_location_name === weddingList.party_location_name &&
                                weddingList.ceremony_address === weddingList.party_address &&
                                weddingList.ceremony_time === weddingList.party_time;

                            if (isSameLocation) {
                                // MERGED VIEW
                                return (
                                    <div className="max-w-xl mx-auto">
                                        <div className="bg-white shadow-xl shadow-gray-200/50 overflow-hidden transform hover:-translate-y-1 transition-all duration-500">
                                            <div className="h-80 relative overflow-hidden">
                                                {weddingList.ceremony_image || weddingList.party_image ? (
                                                    <img
                                                        src={weddingList.ceremony_image || weddingList.party_image}
                                                        className="w-full h-full object-cover"
                                                        alt="Local do Casamento"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-gradient-to-br from-pink-50 to-blue-50 flex items-center justify-center">
                                                        <MapPin className="h-16 w-16 text-pink-300" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent flex items-end p-8">
                                                    <div>
                                                        <h3 className="text-white text-3xl font-serif mb-2">Cerimônia e Recepção</h3>
                                                        <p className="text-white/80 text-sm">Tudo em um só lugar</p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-8 space-y-8">
                                                <div className="flex items-start gap-5">
                                                    <div className="bg-pink-50 p-4 shrink-0 rounded-full">
                                                        <MapPin className="h-6 w-6 text-pink-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-xl text-gray-900">{weddingList.ceremony_location_name}</h4>
                                                        <p className="text-gray-500 font-light text-lg mt-1">{weddingList.ceremony_address}</p>
                                                    </div>
                                                </div>

                                                {(weddingList.wedding_date || weddingList.ceremony_time) && (
                                                    <div className="flex items-center gap-8 pt-6 border-t border-gray-100">
                                                        {weddingList.wedding_date && (
                                                            <div className="flex items-center gap-3 text-gray-700">
                                                                <Calendar className="h-5 w-5 text-pink-500" />
                                                                <span className="text-lg">{formatDateBR(weddingList.wedding_date)}</span>
                                                            </div>
                                                        )}
                                                        {weddingList.ceremony_time && (
                                                            <div className="flex items-center gap-3 text-gray-700">
                                                                <Clock className="h-5 w-5 text-pink-500" />
                                                                <span className="text-lg">{weddingList.ceremony_time}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="overflow-hidden h-56 border border-gray-100">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        frameBorder="0"
                                                        scrolling="no"
                                                        marginHeight={0}
                                                        marginWidth={0}
                                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(weddingList.ceremony_address || weddingList.ceremony_location_name || "")}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                                        className="w-full h-full grayscale hover:grayscale-0 transition-all duration-700 opacity-80 hover:opacity-100"
                                                        title="Mapa do Local"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-pink-200 text-pink-700 hover:bg-pink-50 bg-transparent rounded-none h-12 text-lg"
                                                    onClick={() => openMap(weddingList.ceremony_address || weddingList.ceremony_location_name || "")}
                                                >
                                                    Abrir no Maps
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            }

                            // SEPARATE VIEW (Existing Logic)
                            return (
                                <div className="grid md:grid-cols-2 gap-10">
                                    {/* Ceremony Card */}
                                    {weddingList.ceremony_location_name && (
                                        <div className="bg-white shadow-xl shadow-gray-200/50 overflow-hidden transform hover:-translate-y-1 transition-all duration-500">
                                            <div className="h-64 relative overflow-hidden">
                                                {weddingList.ceremony_image ? (
                                                    <img
                                                        src={weddingList.ceremony_image}
                                                        className="w-full h-full object-cover"
                                                        alt="Cerimônia"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-blue-50 flex items-center justify-center">
                                                        <MapPin className="h-12 w-12 text-blue-200" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                                                    <h3 className="text-white text-3xl font-serif">Cerimônia</h3>
                                                </div>
                                            </div>
                                            <div className="p-8 space-y-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="bg-blue-50 p-3 shrink-0">
                                                        <MapPin className="h-6 w-6 text-blue-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg text-gray-900">{weddingList.ceremony_location_name}</h4>
                                                        <p className="text-gray-500 font-light">{weddingList.ceremony_address}</p>
                                                    </div>
                                                </div>

                                                {(weddingList.wedding_date || weddingList.ceremony_time) && (
                                                    <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                                                        {weddingList.wedding_date && (
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <Calendar className="h-4 w-4 text-pink-500" />
                                                                <span>
                                                                    {(() => {
                                                                        const dateStr = String(weddingList.wedding_date).split('T')[0];
                                                                        const [y, m, d] = dateStr.split('-').map(Number);
                                                                        const date = new Date(y, m - 1, d);
                                                                        return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
                                                                    })()}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {weddingList.ceremony_time && (
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <Clock className="h-4 w-4 text-pink-500" />
                                                                <span>{weddingList.ceremony_time}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="overflow-hidden h-48 border border-gray-100">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        frameBorder="0"
                                                        scrolling="no"
                                                        marginHeight={0}
                                                        marginWidth={0}
                                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(weddingList.ceremony_address || weddingList.ceremony_location_name || "")}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                                        className="w-full h-full grayscale hover:grayscale-0 transition-all duration-700 opacity-80 hover:opacity-100"
                                                        title="Mapa da Cerimônia"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-blue-200 text-blue-700 hover:bg-blue-50 bg-transparent rounded-none"
                                                    onClick={() => openMap(weddingList.ceremony_address || weddingList.ceremony_location_name || "")}
                                                >
                                                    Abrir no Maps
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Party Card */}
                                    {weddingList.has_party && (
                                        <div className="bg-white shadow-xl shadow-gray-200/50 overflow-hidden transform hover:-translate-y-1 transition-all duration-500">
                                            <div className="h-64 relative overflow-hidden">
                                                {weddingList.party_image ? (
                                                    <img
                                                        src={weddingList.party_image}
                                                        className="w-full h-full object-cover"
                                                        alt="Festa"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full bg-orange-50 flex items-center justify-center">
                                                        <Navigation className="h-12 w-12 text-orange-200" />
                                                    </div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-8">
                                                    <h3 className="text-white text-3xl font-serif">Recepção</h3>
                                                </div>
                                            </div>
                                            <div className="p-8 space-y-6">
                                                <div className="flex items-start gap-4">
                                                    <div className="bg-orange-50 p-3 shrink-0">
                                                        <Navigation className="h-6 w-6 text-orange-600" />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-lg text-gray-900">{weddingList.party_location_name || "A Definir"}</h4>
                                                        <p className="text-gray-500 font-light">{weddingList.party_address}</p>
                                                    </div>
                                                </div>

                                                {(weddingList.party_date || weddingList.party_time) && (
                                                    <div className="flex items-center gap-6 pt-4 border-t border-gray-100">
                                                        {weddingList.party_date && (
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <Calendar className="h-4 w-4 text-orange-500" />
                                                                <span>{formatDateBR(weddingList.party_date)}</span>
                                                            </div>
                                                        )}
                                                        {weddingList.party_time && (
                                                            <div className="flex items-center gap-2 text-gray-600">
                                                                <Clock className="h-4 w-4 text-orange-500" />
                                                                <span>{weddingList.party_time}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                <div className="overflow-hidden h-48 border border-gray-100">
                                                    <iframe
                                                        width="100%"
                                                        height="100%"
                                                        frameBorder="0"
                                                        scrolling="no"
                                                        marginHeight={0}
                                                        marginWidth={0}
                                                        src={`https://maps.google.com/maps?q=${encodeURIComponent(weddingList.party_address || weddingList.party_location_name || "")}&t=&z=15&ie=UTF8&iwloc=&output=embed`}
                                                        className="w-full h-full grayscale hover:grayscale-0 transition-all duration-700 opacity-80 hover:opacity-100"
                                                        title="Mapa da Festa"
                                                        loading="lazy"
                                                    />
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    className="w-full border-orange-200 text-orange-700 hover:bg-orange-50 bg-transparent rounded-none"
                                                    onClick={() => openMap(weddingList.party_address || weddingList.party_location_name || "")}
                                                >
                                                    Abrir no Maps
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}
                    </div>
                </section>
            )}
        </div>
    );
};

export default CoupleStory;

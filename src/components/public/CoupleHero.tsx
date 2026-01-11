import React, { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import type { WeddingList } from "@/types";

interface CoupleHeroProps {
    weddingList: WeddingList;
}

const CoupleHero: React.FC<CoupleHeroProps> = ({ weddingList }) => {
    const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

    useEffect(() => {
        if (!weddingList.wedding_date) return;

        const updateCountdown = () => {
            const dateStr = weddingList.wedding_date!.toString();
            let weddingDate: Date;

            // Robust parsing to force local timezone Interpretation
            // This prevents "2026-05-15" from being treated as UTC and shifting to "May 14th" in some timezones
            const datePart = dateStr.split('T')[0];
            const parts = datePart.split('-');

            if (parts.length === 3) {
                const year = parseInt(parts[0]);
                const month = parseInt(parts[1]) - 1;
                const day = parseInt(parts[2]);

                let hours = 0;
                let minutes = 0;

                if (weddingList.ceremony_time) {
                    const timeParts = weddingList.ceremony_time.split(':');
                    if (timeParts.length >= 2) {
                        hours = parseInt(timeParts[0]);
                        minutes = parseInt(timeParts[1]);
                    }
                }

                weddingDate = new Date(year, month, day, hours, minutes, 0);
            } else {
                // Fallback for unexpected formats
                weddingDate = new Date(dateStr);
            }

            const now = new Date();
            const diff = weddingDate.getTime() - now.getTime();

            // Debug for User Issue "000000"
            // If diff <= 0, it means the browser thinks the event has passed.
            if (diff <= 0) {
                // console.warn("Timer: Event appears to be in the past.", { weddingDate, now });
            }

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
        };

        const interval = setInterval(updateCountdown, 1000);
        updateCountdown();

        return () => clearInterval(interval);
    }, [weddingList.wedding_date, weddingList.ceremony_time]);

    // Helper to add Supabase Image Transform params
    const getOptimizedImageUrl = (url: string | null | undefined, isMobile: boolean): string | null => {
        if (!url) return null;

        // Only transform Supabase Storage URLs
        if (!url.includes('supabase') || !url.includes('/storage/')) {
            return url;
        }

        // Add transform params
        const width = isMobile ? 800 : 1200;
        const height = isMobile ? 600 : 800;
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}width=${width}&height=${height}&resize=cover&quality=75`;
    };

    // Determine cover image with responsive optimization
    const isMobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    const rawCoverImage = isMobileView
        ? (weddingList.cover_image_mobile || weddingList.cover_image_desktop)
        : (weddingList.cover_image_desktop || weddingList.cover_image_mobile);
    const coverImage = getOptimizedImageUrl(rawCoverImage, isMobileView);

    return (
        <div className="relative w-full h-[600px] flex items-center justify-center overflow-hidden">
            {/* Background Image - Optimized for LCP */}
            {coverImage ? (
                <img
                    src={coverImage}
                    alt="Capa do Casamento"
                    className="absolute inset-0 w-full h-full object-cover transform scale-105"
                    loading="eager"
                    // @ts-ignore - React type definition might lack fetchPriority
                    fetchPriority="high"
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
    );
};

export default CoupleHero;

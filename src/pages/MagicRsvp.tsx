"use client";

import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Heart } from "lucide-react";
import EnvelopeRsvp from "@/components/public/EnvelopeRsvp";

/**
 * Magic RSVP Page
 * 
 * Accessed via /lista/:slug/rsvp/:envelopeSlug
 * Opens the envelope directly for confirmed guests.
 */
const MagicRsvp: React.FC = () => {
    const { slug, envelopeSlug } = useParams<{ slug: string; envelopeSlug: string }>();
    const navigate = useNavigate();
    const [weddingListId, setWeddingListId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadWeddingList = async () => {
            if (!slug) {
                setError("Lista não encontrada");
                setIsLoading(false);
                return;
            }

            try {
                const { data, error: dbError } = await supabase
                    .from("wedding_lists")
                    .select("id")
                    .eq("slug", slug)
                    .eq("is_public", true)
                    .single();

                if (dbError || !data) {
                    setError("Lista não encontrada");
                    return;
                }

                setWeddingListId(data.id);
            } catch (err) {
                setError("Erro ao carregar lista");
            } finally {
                setIsLoading(false);
            }
        };

        loadWeddingList();
    }, [slug]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 text-pink-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600">Carregando seu convite...</p>
                </div>
            </div>
        );
    }

    if (error || !weddingListId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <div className="text-center">
                    <Heart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Convite não encontrado</h1>
                    <p className="text-gray-600 mb-4">{error || "O link pode estar incorreto"}</p>
                    <button
                        onClick={() => navigate(`/lista/${slug}`)}
                        className="text-pink-500 hover:text-pink-600 underline"
                    >
                        Ir para a lista de presentes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 py-8 px-4">
            <div className="max-w-xl mx-auto">
                <EnvelopeRsvp
                    weddingListId={weddingListId}
                    weddingSlug={slug}
                    envelopeSlug={envelopeSlug}
                />
            </div>
        </div>
    );
};

export default MagicRsvp;

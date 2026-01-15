"use client";

import React from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CalendarCheck, MessageSquare, X } from "lucide-react";

interface GiftThankYouModalProps {
    isOpen: boolean;
    onClose: () => void;
    coupleName: string;
    onConfirmRsvp: () => void;
    onLeaveMessage: () => void;
}

const GiftThankYouModal = ({
    isOpen,
    onClose,
    coupleName,
    onConfirmRsvp,
    onLeaveMessage,
}: GiftThankYouModalProps) => {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md p-0 overflow-hidden border-0 bg-transparent shadow-none">
                <div className="bg-gradient-to-br from-pink-50 via-white to-purple-50 rounded-2xl p-8 relative shadow-2xl">
                    {/* Close Button */}
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* Gift Emoji Animation */}
                    <div className="text-center mb-6">
                        <div className="inline-block animate-bounce">
                            <span className="text-7xl drop-shadow-lg">🎁</span>
                        </div>
                    </div>

                    {/* Thank You Message */}
                    <DialogHeader className="text-center space-y-3 mb-6">
                        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
                            Presente Enviado!
                        </DialogTitle>
                        <p className="text-gray-600 leading-relaxed">
                            Muito obrigado pelo carinho! 💝
                            <br />
                            <span className="font-semibold text-gray-800">
                                {coupleName}
                            </span>{" "}
                            ficarão muito felizes com seu presente.
                        </p>
                    </DialogHeader>

                    {/* Action Buttons */}
                    <div className="space-y-3">
                        <Button
                            onClick={onConfirmRsvp}
                            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-lg shadow-green-200 py-6 text-lg font-semibold rounded-xl transition-all duration-300 hover:scale-[1.02]"
                        >
                            <CalendarCheck className="w-5 h-5 mr-2" />
                            Confirmar Presença
                        </Button>

                        <Button
                            onClick={onLeaveMessage}
                            variant="outline"
                            className="w-full border-2 border-pink-200 hover:bg-pink-50 text-gray-700 py-6 text-lg font-medium rounded-xl transition-all duration-300 hover:border-pink-300"
                        >
                            <MessageSquare className="w-5 h-5 mr-2 text-pink-500" />
                            Deixar uma Mensagem
                        </Button>

                        <button
                            onClick={onClose}
                            className="w-full text-gray-400 hover:text-gray-600 text-sm py-2 transition-colors"
                        >
                            Continuar navegando
                        </button>
                    </div>

                    {/* Decorative Hearts */}
                    <div className="absolute -top-2 -left-2 text-2xl opacity-50 animate-pulse">💕</div>
                    <div className="absolute -bottom-2 -right-2 text-2xl opacity-50 animate-pulse" style={{ animationDelay: '0.5s' }}>💕</div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default GiftThankYouModal;

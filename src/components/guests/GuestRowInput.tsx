import React, { useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Trash2, Check, MessageCircle } from "lucide-react";

interface GuestRowData {
    id: string;
    name: string;
    whatsapp: string;
    guest_type: "adult" | "child";
}

interface GuestRowInputProps {
    guest: GuestRowData;
    index: number;
    isLast: boolean;
    onChange: (id: string, field: keyof GuestRowData, value: string) => void;
    onDelete: (id: string) => void;
    onAddNew: () => void;
    autoFocus?: boolean;
}

// WhatsApp mask helper
const formatWhatsApp = (value: string): string => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

const isValidWhatsApp = (value: string): boolean => {
    const digits = value.replace(/\D/g, "");
    return digits.length === 11;
};

const GuestRowInput: React.FC<GuestRowInputProps> = ({
    guest,
    index,
    isLast,
    onChange,
    onDelete,
    onAddNew,
    autoFocus = false,
}) => {
    const nameInputRef = useRef<HTMLInputElement>(null);
    const whatsappInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (autoFocus && nameInputRef.current) {
            nameInputRef.current.focus();
        }
    }, [autoFocus]);

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (guest.name.trim()) {
                onAddNew();
            }
        } else if (e.key === "Tab" && !e.shiftKey) {
            // Let Tab naturally move to WhatsApp
        }
    };

    const handleWhatsAppKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (guest.name.trim()) {
                onAddNew();
            }
        }
    };

    const handleWhatsAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const formatted = formatWhatsApp(e.target.value);
        onChange(guest.id, "whatsapp", formatted);
    };

    const handleTypeChange = (value: string) => {
        onChange(guest.id, "guest_type", value as "adult" | "child");
    };

    const handleTypeKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            if (guest.name.trim()) {
                onAddNew();
            }
        }
    };

    const whatsappValid = isValidWhatsApp(guest.whatsapp);
    const whatsappHasValue = guest.whatsapp.replace(/\D/g, "").length > 0;

    return (
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-2 p-3 sm:p-2 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors group relative">
            {/* Top Row (Mobile) / Left Side (Desktop) */}
            <div className="flex items-center gap-2 w-full sm:w-auto sm:flex-1 min-w-0">
                {/* Row Number */}
                <span className="text-xs text-gray-400 w-6 text-center font-mono pt-2 sm:pt-0">
                    {index + 1}
                </span>

                {/* Name Input */}
                <div className="flex-1 min-w-0">
                    <Input
                        ref={nameInputRef}
                        value={guest.name}
                        onChange={(e) => onChange(guest.id, "name", e.target.value)}
                        onKeyDown={handleNameKeyDown}
                        placeholder="Nome Completo"
                        className="h-9 bg-white border-gray-200 focus:border-pink-300 focus:ring-pink-200"
                    />
                </div>

                {/* Delete Button (Mobile Only) */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(guest.id)}
                    className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50 sm:hidden"
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>

            {/* Bottom Row (Mobile) / Right Side (Desktop) */}
            <div className="flex items-center gap-2 w-full sm:w-auto pl-8 sm:pl-0">
                {/* WhatsApp Input */}
                <div className="relative flex-1 sm:w-40 sm:flex-none">
                    <Input
                        ref={whatsappInputRef}
                        value={guest.whatsapp}
                        onChange={handleWhatsAppChange}
                        onKeyDown={handleWhatsAppKeyDown}
                        placeholder="(XX) XXXXX-XXXX"
                        className="h-9 bg-white border-gray-200 focus:border-pink-300 focus:ring-pink-200 pr-8"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {whatsappHasValue ? (
                            whatsappValid ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <MessageCircle className="w-4 h-4 text-gray-300" />
                            )
                        ) : (
                            <MessageCircle className="w-4 h-4 text-gray-200" />
                        )}
                    </div>
                </div>

                {/* Type Select */}
                <Select value={guest.guest_type} onValueChange={handleTypeChange}>
                    <SelectTrigger
                        className="w-[110px] sm:w-28 h-9 bg-white border-gray-200 flex-shrink-0"
                        onKeyDown={handleTypeKeyDown}
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="adult">Adulto</SelectItem>
                        <SelectItem value="child">Criança</SelectItem>
                    </SelectContent>
                </Select>

                {/* Delete Button (Desktop Only) */}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(guest.id)}
                    className="h-9 w-9 text-gray-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex"
                    tabIndex={-1}
                >
                    <Trash2 className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default GuestRowInput;

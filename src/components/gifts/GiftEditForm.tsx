import React, { useState, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, X, Gift, Link as LinkIcon, ImagePlus, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { showError, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES } from "@/constants/messages";
import type { Gift as GiftType } from "@/types";

// Platform fee percentage
const PLATFORM_FEE_PERCENT = 5;

const CATEGORIES = [
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

const giftSchema = z.object({
    name: z.string().min(1, "Nome é obrigatório"),
    description: z.string().optional(),
    price: z.coerce.number().min(1, "Preço deve ser maior que zero"),
    category: z.string().optional(),
    is_unlimited: z.boolean().default(false),
    quantity_total: z.coerce.number().min(1).default(1),
    is_quota: z.boolean().default(false),
});

type GiftFormData = z.infer<typeof giftSchema>;

interface GiftEditFormProps {
    initialData?: GiftType;
    weddingListId: string;
    onSave: (gift: GiftType, createAnother: boolean) => void;
    onCancel: () => void;
}

const GiftEditForm: React.FC<GiftEditFormProps> = ({
    initialData,
    weddingListId,
    onSave,
    onCancel,
}) => {
    const [isLoading, setIsLoading] = useState(false);
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(
        initialData?.image_url || null
    );
    const [imageUrlInput, setImageUrlInput] = useState("");
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const form = useForm<GiftFormData>({
        resolver: zodResolver(giftSchema),
        defaultValues: {
            name: initialData?.name || "",
            description: initialData?.description || "",
            price: initialData?.price || 0,
            category: initialData?.category || "",
            is_unlimited: (initialData?.quantity_total || 1) > 99,
            quantity_total: initialData?.quantity_total || 1,
            is_quota: initialData?.is_quota || false,
        },
    });

    const watchedValues = form.watch();
    const isUnlimited = form.watch("is_unlimited");
    const isQuota = form.watch("is_quota");

    // Calculate fees in real-time
    const price = watchedValues.price || 0;
    const platformFee = price * (PLATFORM_FEE_PERCENT / 100);
    const netAmount = price - platformFee;

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    // Drag & Drop handlers
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith("image/")) {
            processImageFile(file);
        }
    }, []);

    const processImageFile = (file: File) => {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            processImageFile(file);
        }
    };

    const handleUrlPaste = () => {
        if (imageUrlInput.trim()) {
            setImagePreview(imageUrlInput.trim());
            setImageFile(null);
            setImageUrlInput("");
        }
    };

    const removeImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setImageUrlInput("");
    };

    const onSubmit = async (data: GiftFormData, createAnother: boolean = false) => {
        setIsLoading(true);

        try {
            let imageUrl = initialData?.image_url || null;

            // Upload new image if file selected
            if (imageFile) {
                const { data: { user } } = await supabase.auth.getUser();
                if (!user) throw new Error("Usuário não autenticado");

                const fileExtension = imageFile.name.split(".").pop();
                const filePath = `${user.id}/${crypto.randomUUID()}.${fileExtension}`;

                const { error: uploadError } = await supabase.storage
                    .from("gift-images")
                    .upload(filePath, imageFile, { cacheControl: "3600", upsert: false });

                if (uploadError) throw uploadError;

                imageUrl = supabase.storage
                    .from("gift-images")
                    .getPublicUrl(filePath).data.publicUrl;

                // Delete old image if exists
                if (initialData?.image_url) {
                    const oldPath = initialData.image_url.split("gift-images/")[1];
                    if (oldPath) {
                        await supabase.storage.from("gift-images").remove([oldPath]);
                    }
                }
            } else if (imagePreview && !imageFile && imagePreview !== initialData?.image_url) {
                // URL was pasted
                imageUrl = imagePreview;
            } else if (!imagePreview && initialData?.image_url) {
                // Image was removed
                const oldPath = initialData.image_url.split("gift-images/")[1];
                if (oldPath) {
                    await supabase.storage.from("gift-images").remove([oldPath]);
                }
                imageUrl = null;
            }

            const giftData = {
                name: data.name,
                description: data.description || null,
                price: data.price,
                image_url: imageUrl,
                quantity_total: data.is_unlimited ? 9999 : data.quantity_total,
                category: data.category || null,
                priority: "medium" as const,
                wedding_list_id: weddingListId,
                is_quota: data.is_quota,
            };

            if (initialData?.id) {
                const { data: updatedGift, error } = await supabase
                    .from("gifts")
                    .update(giftData)
                    .eq("id", initialData.id)
                    .select()
                    .single();

                if (error) throw error;
                onSave(updatedGift as GiftType, createAnother);
            } else {
                const { data: newGift, error } = await supabase
                    .from("gifts")
                    .insert(giftData)
                    .select()
                    .single();

                if (error) throw error;
                onSave(newGift as GiftType, createAnother);
            }
        } catch (error: any) {
            showUserError(ADMIN_MESSAGES.error.SAVE_FAILED, error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        form.handleSubmit((data) => onSubmit(data, false))();
    };

    const handleSaveAndCreateAnother = () => {
        form.handleSubmit((data) => onSubmit(data, true))();
    };

    return (
        <div className="grid lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-6">
                <Form {...form}>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Image Upload Section */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium flex items-center gap-2">
                                <ImagePlus className="h-4 w-4" />
                                Foto do Presente
                            </label>

                            {imagePreview ? (
                                <div className="relative group">
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        className="w-full h-48 object-cover rounded-xl border-2 border-pink-200"
                                    />
                                    <button
                                        type="button"
                                        onClick={removeImage}
                                        className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div
                                    className={`
                    border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer
                    ${isDragging
                                            ? "border-pink-500 bg-pink-50"
                                            : "border-gray-300 hover:border-pink-400 hover:bg-pink-50/50"
                                        }
                  `}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                                    <p className="text-sm text-gray-600 font-medium">
                                        Arraste uma foto aqui
                                    </p>
                                    <p className="text-xs text-gray-400 mt-1">
                                        ou clique para selecionar
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                        className="hidden"
                                    />
                                </div>
                            )}

                            {/* URL Paste option */}
                            {!imagePreview && (
                                <div className="flex gap-2 mt-2">
                                    <Input
                                        placeholder="Ou cole a URL de uma imagem..."
                                        value={imageUrlInput}
                                        onChange={(e) => setImageUrlInput(e.target.value)}
                                        className="text-sm"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleUrlPaste}
                                        disabled={!imageUrlInput.trim()}
                                    >
                                        <LinkIcon className="h-4 w-4" />
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* Name */}
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Nome do Presente *</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="Ex: Jantar Romântico em Paris"
                                            {...field}
                                            disabled={isLoading}
                                            className="text-lg"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Description */}
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Descrição</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Para o noivo fazer bolos queimados... 🎂"
                                            {...field}
                                            disabled={isLoading}
                                            rows={2}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Seja criativo! Os convidados vão adorar.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Category */}
                        <FormField
                            control={form.control}
                            name="category"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Categoria</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        defaultValue={field.value}
                                        disabled={isLoading}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione uma categoria" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {CATEGORIES.map((cat) => (
                                                <SelectItem key={cat.value} value={cat.value}>
                                                    {cat.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* Quota Type Toggle */}
                        <FormField
                            control={form.control}
                            name="is_quota"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-gray-50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base flex items-center gap-2">
                                            {field.value ? <Sparkles className="h-4 w-4 text-purple-500" /> : <Gift className="h-4 w-4 text-blue-500" />}
                                            {field.value ? "Dividir em Cotas (Ex: Lua de Mel)" : "Item de Valor Único (Ex: Eletro)"}
                                        </FormLabel>
                                        <p className="text-sm text-gray-500">
                                            {field.value
                                                ? "Permite que os convidados comprem 'pedaços' do presente (ideal para valores altos)."
                                                : "O convidado paga o valor cheio do item (ideal para presentes tradicionais)."}
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Price with Fee Calculator */}
                        <FormField
                            control={form.control}
                            name="price"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Valor {isQuota ? "da Cota" : "do Presente"} *</FormLabel>
                                    <FormControl>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">
                                                R$
                                            </span>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                min="1"
                                                placeholder="0,00"
                                                {...field}
                                                disabled={isLoading}
                                                className="pl-10 text-lg font-semibold"
                                            />
                                        </div>
                                    </FormControl>
                                    <FormMessage />

                                    {/* Real-time Fee Calculator */}
                                    {price > 0 && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                                            <div className="flex justify-between text-gray-600">
                                                <span>Taxa do site ({PLATFORM_FEE_PERCENT}%):</span>
                                                <span className="text-red-500">- {formatCurrency(platformFee)}</span>
                                            </div>
                                            <div className="flex justify-between font-semibold border-t pt-2">
                                                <span>Você recebe:</span>
                                                <span className="text-green-600 text-base">{formatCurrency(netAmount)}</span>
                                            </div>
                                        </div>
                                    )}
                                </FormItem>
                            )}
                        />

                        {/* Quantity Type Toggle */}
                        <FormField
                            control={form.control}
                            name="is_unlimited"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between rounded-lg border p-4 bg-gray-50">
                                    <div className="space-y-0.5">
                                        <FormLabel className="text-base">
                                            {isQuota ? "Cotas Ilimitadas?" : "Estoque Ilimitado?"}
                                        </FormLabel>
                                        <p className="text-sm text-gray-500">
                                            {field.value
                                                ? isQuota ? "Convidados podem comprar quantas cotas quiserem." : "Produto nunca esgota."
                                                : isQuota ? "Cotas acabam quando atingir o limite." : "Produto sai da lista quando comprado."}
                                        </p>
                                    </div>
                                    <FormControl>
                                        <Switch
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={isLoading}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />

                        {/* Quantity (if not unlimited) */}
                        {!isUnlimited && (
                            <FormField
                                control={form.control}
                                name="quantity_total"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {isQuota ? "Quantidade de Cotas" : "Quantidade em Estoque"}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                min="1"
                                                max="999"
                                                {...field}
                                                disabled={isLoading}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            {isQuota ? "Ex: 10 cotas de R$ 100" : "Ex: 6 pratos iguais"}
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}



                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 pt-4 border-t">
                            <div className="flex gap-3">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onCancel}
                                    disabled={isLoading}
                                    className="flex-1"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 bg-pink-500 hover:bg-pink-600 text-white"
                                >
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                            Salvando...
                                        </>
                                    ) : (
                                        <>
                                            <Sparkles className="h-4 w-4 mr-2" />
                                            {initialData ? "Atualizar" : "Salvar e Voltar"}
                                        </>
                                    )}
                                </Button>
                            </div>

                            {!initialData && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={handleSaveAndCreateAnother}
                                    disabled={isLoading}
                                    className="w-full"
                                >
                                    Salvar e Criar Outro
                                </Button>
                            )}
                        </div>
                    </form>
                </Form>
            </div>

            {/* Live Preview Card */}
            <div className="hidden lg:block">
                <div className="sticky top-6">
                    <p className="text-sm font-medium text-gray-500 mb-3 flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-pink-500" />
                        Pré-visualização
                    </p>

                    <Card className="overflow-hidden shadow-lg hover:shadow-xl transition-shadow">
                        {/* Image */}
                        <div className="aspect-square bg-gradient-to-br from-pink-100 to-purple-100 relative">
                            {imagePreview ? (
                                <img
                                    src={imagePreview}
                                    alt={watchedValues.name || "Preview"}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400">
                                    <Gift className="h-16 w-16 mb-2" />
                                    <span className="text-sm">Adicione uma foto</span>
                                </div>
                            )}

                            {/* Category Badge */}
                            {watchedValues.category && (
                                <Badge className="absolute top-3 left-3 bg-white/90 text-gray-700">
                                    {CATEGORIES.find(c => c.value === watchedValues.category)?.label || watchedValues.category}
                                </Badge>
                            )}

                            {/* Quantity/Quota Badge */}
                            {/* Quantity/Quota Badge */}
                            {isUnlimited ? (
                                isQuota && (
                                    <Badge className="absolute top-3 right-3 text-white bg-green-500">
                                        Cotas Ilimitadas
                                    </Badge>
                                )
                            ) : (
                                <Badge className={`absolute top-3 right-3 text-white ${isQuota ? "bg-green-500" : "bg-blue-500"}`}>
                                    {isQuota
                                        ? `${watchedValues.quantity_total} Cotas`
                                        : `${watchedValues.quantity_total} Unidades`}
                                </Badge>
                            )}
                        </div>

                        {/* Content */}
                        <CardContent className="p-4">
                            <h3 className="font-semibold text-lg text-gray-800 mb-1">
                                {watchedValues.name || "Nome do Presente"}
                            </h3>

                            {watchedValues.description && (
                                <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                                    {watchedValues.description}
                                </p>
                            )}

                            <div className="flex items-center justify-between">
                                <span className="text-2xl font-bold text-pink-600">
                                    {price > 0 ? formatCurrency(price) : "R$ --,--"}
                                </span>
                                <Button size="sm" className="bg-pink-500 hover:bg-pink-600">
                                    Presentear
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    <p className="text-xs text-gray-400 text-center mt-3">
                        É assim que os convidados vão ver seu presente ✨
                    </p>
                </div>
            </div>
        </div>
    );
};

export default GiftEditForm;

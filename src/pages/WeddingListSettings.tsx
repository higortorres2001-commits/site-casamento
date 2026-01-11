import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Heart, Loader2, Copy, ArrowLeft, Check, Calendar, MapPin, Palette, Image as ImageIcon } from "lucide-react";
import ImageUpload from "@/components/ui/image-upload";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES } from "@/constants/messages";
import { useSession } from "@/components/SessionContextProvider";
import { generateCoupleSlug } from "@/utils/slug-generator";
import type { WeddingList } from "@/types";

const listSchema = z.object({
    // Essential
    bride_name: z.string().min(2, "Seu nome é obrigatório"),
    groom_name: z.string().min(2, "Nome do seu amor é obrigatório"),
    wedding_date: z.string().min(1, "Data do casamento é obrigatória"),
    description: z.string().optional(),
    is_public: z.boolean().default(true),

    // Ceremony
    ceremony_location_name: z.string().optional(),
    ceremony_address: z.string().optional(),
    ceremony_image: z.string().optional(),
    ceremony_time: z.string().optional(),

    // Party
    has_party: z.boolean().default(false),
    party_date: z.string().optional(),
    party_time: z.string().optional(),
    party_location_name: z.string().optional(),
    party_address: z.string().optional(),
    party_image: z.string().optional(),

    // Personalization
    couple_profile_image: z.string().optional(),
    cover_image_mobile: z.string().optional(),
    cover_image_desktop: z.string().optional(),
    couple_story: z.string().optional(),
    brand_color: z.string().default("#ec4899"),
    gallery_images: z.array(z.string()).default([]),
});

type ListFormData = z.infer<typeof listSchema>;

const WeddingListSettings = () => {
    const { user, isLoading: isSessionLoading } = useSession();
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [copied, setCopied] = useState(false);
    const [isSameLocation, setIsSameLocation] = useState(false);
    const navigate = useNavigate();

    const form = useForm<ListFormData>({
        resolver: zodResolver(listSchema),
        defaultValues: {
            bride_name: "",
            groom_name: "",
            wedding_date: "",
            description: "",
            is_public: true,
            ceremony_location_name: "",
            ceremony_address: "",
            ceremony_image: "",
            ceremony_time: "",
            has_party: false,
            party_date: "",
            party_time: "",
            party_location_name: "",
            party_address: "",
            party_image: "",
            couple_profile_image: "",
            cover_image_mobile: "",
            cover_image_desktop: "",
            couple_story: "",
            brand_color: "#ec4899",
            gallery_images: [],
        },
    });

    useEffect(() => {
        const loadList = async () => {
            if (!user?.id) {
                setIsLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from("wedding_lists")
                .select("*")
                .eq("user_id", user.id)
                .single();

            if (error && error.code !== "PGRST116") {
                showUserError(ADMIN_MESSAGES.error.LOAD_LIST_FAILED, error);
            }


            if (data) {
                setWeddingList(data as WeddingList);

                // Check if party matches ceremony to init toggle
                const sameLoc =
                    data.ceremony_location_name === data.party_location_name &&
                    data.ceremony_address === data.party_address &&
                    data.ceremony_time === data.party_time &&
                    (data.wedding_date === data.party_date || data.party_date === null); // assume same date if null or matching

                setIsSameLocation(sameLoc);

                form.reset({
                    bride_name: data.bride_name,
                    groom_name: data.groom_name,
                    wedding_date: data.wedding_date || "",
                    description: data.description || "",
                    is_public: true,
                    ceremony_location_name: data.ceremony_location_name || "",
                    ceremony_address: data.ceremony_address || "",
                    ceremony_image: data.ceremony_image || "",
                    ceremony_time: data.ceremony_time || "",
                    has_party: data.has_party || false,
                    party_date: data.party_date ? data.party_date.split("T")[0] : "",
                    party_time: data.party_time || "",
                    party_location_name: data.party_location_name || "",
                    party_address: data.party_address || "",
                    party_image: data.party_image || "",
                    couple_profile_image: data.couple_profile_image || "",
                    cover_image_mobile: data.cover_image_mobile || "",
                    cover_image_desktop: data.cover_image_desktop || "",
                    couple_story: data.couple_story || "",
                    brand_color: data.brand_color || "#ec4899",
                    gallery_images: data.gallery_images || [],
                });
            }

            setIsLoading(false);
        };

        if (!isSessionLoading) {
            if (user) {
                loadList();
            } else {
                navigate("/login");
            }
        }
    }, [user, isSessionLoading, navigate, form]);

    // Sync fields when Same Location is active
    useEffect(() => {
        if (isSameLocation) {
            const subscription = form.watch((value, { name, type }) => {
                if (name?.startsWith('ceremony_') || name === 'wedding_date') {
                    const cLoc = form.getValues('ceremony_location_name');
                    const cAddr = form.getValues('ceremony_address');
                    const cTime = form.getValues('ceremony_time');
                    const wDate = form.getValues('wedding_date');

                    form.setValue('party_location_name', cLoc || "", { shouldDirty: true });
                    form.setValue('party_address', cAddr || "", { shouldDirty: true });
                    form.setValue('party_time', cTime || "", { shouldDirty: true });
                    form.setValue('party_date', wDate || "", { shouldDirty: true });
                }
            });
            return () => subscription.unsubscribe();
        }
    }, [isSameLocation, form.watch, form.setValue]);

    // Also trigger immediate sync when toggled ON
    const handleSameLocationToggle = (checked: boolean) => {
        setIsSameLocation(checked);
        if (checked) {
            const cLoc = form.getValues('ceremony_location_name');
            const cAddr = form.getValues('ceremony_address');
            const cTime = form.getValues('ceremony_time');
            const wDate = form.getValues('wedding_date');

            form.setValue('party_location_name', cLoc || "");
            form.setValue('party_address', cAddr || "");
            form.setValue('party_time', cTime || "");
            form.setValue('party_date', wDate || "");
        }
    };

    const onSubmit = async (data: ListFormData) => {
        if (!user?.id) return;

        setIsSaving(true);

        try {
            const slug = weddingList?.slug || generateCoupleSlug(data.bride_name, data.groom_name);

            const listData = {
                ...data,
                slug,
                user_id: user.id,
                is_public: true,
                wedding_date: data.wedding_date || null, // Ensure explicit null if empty, though schema mandates required
                party_date: data.party_date || null,
            };

            if (weddingList?.id) {
                // Update existing
                const { data: updated, error } = await supabase
                    .from("wedding_lists")
                    .update(listData)
                    .eq("id", weddingList.id)
                    .select()
                    .single();

                if (error) throw error;
                setWeddingList(updated as WeddingList);
                showSuccess(ADMIN_MESSAGES.success.LIST_UPDATED);
            } else {
                // Create new
                const { data: created, error } = await supabase
                    .from("wedding_lists")
                    .insert(listData)
                    .select()
                    .single();

                if (error) throw error;
                setWeddingList(created as WeddingList);
                showSuccess(ADMIN_MESSAGES.success.LIST_CREATED);
            }
        } catch (error: any) {
            showUserError(ADMIN_MESSAGES.error.SAVE_FAILED, error);
        } finally {
            setIsSaving(false);
        }
    };

    const copyLink = async () => {
        if (!weddingList?.slug) return;
        const link = `${window.location.origin}/lista/${weddingList.slug}`;
        try {
            await navigator.clipboard.writeText(link);
            setCopied(true);
            showSuccess("Link copiado!");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            showUserError("Erro ao copiar link", err);
        }
    };

    if (isSessionLoading || isLoading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">
                            {weddingList ? "Editar Detalhes" : "Criar Lista"}
                        </h1>
                        <p className="text-gray-600">Personalize sua página de casamento</p>
                    </div>
                </div>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <Tabs defaultValue="essential" className="w-full">
                            <TabsList className="grid w-full grid-cols-4 mb-8">
                                <TabsTrigger value="essential">Essencial</TabsTrigger>
                                <TabsTrigger value="personalization">Personalização</TabsTrigger>
                                <TabsTrigger value="ceremony">Cerimônia</TabsTrigger>
                                <TabsTrigger
                                    value="party"
                                    disabled={!form.watch("has_party")}
                                    className="data-[state=active]:bg-orange-50 data-[state=active]:text-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Festa
                                </TabsTrigger>
                            </TabsList>

                            {/* --- TAB: ESSENCIAL --- */}
                            <TabsContent value="essential">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Heart className="h-5 w-5 text-pink-500" />
                                            Informações Básicas
                                        </CardTitle>
                                        <CardDescription>Obrigatórios para criar sua lista</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="bride_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Seu Nome *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Maria" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="groom_name"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Nome do Seu Amor *</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="João" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="wedding_date"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Data da Cerimônia *</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="date"
                                                            min={new Date().toISOString().split("T")[0]}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="description"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Mensagem de Boas-vindas</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Uma mensagem carinhosa para seus convidados..."
                                                            rows={3}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        {weddingList?.slug && (
                                            <div className="rounded-lg border p-4 bg-pink-50/50 border-pink-100 mt-4">
                                                <p className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                                                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                                    Sua lista está visível em:
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    <code className="flex-1 text-sm bg-white px-3 py-2 rounded border truncate text-pink-600 font-medium">
                                                        {window.location.origin}/lista/{weddingList.slug}
                                                    </code>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        onClick={copyLink}
                                                        className="hover:bg-pink-50 hover:text-pink-600"
                                                    >
                                                        {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* --- TAB: PERSONALIZAÇÃO --- */}
                            <TabsContent value="personalization">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Palette className="h-5 w-5 text-purple-500" />
                                            Identidade Visual
                                        </CardTitle>
                                        <CardDescription>Deixe sua página com a sua cara</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-6">
                                        <div className="grid md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="couple_profile_image"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <ImageUpload
                                                            label="Foto de Perfil do Casal (opcional)"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            aspectRatio="square"
                                                        />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="flex items-center justify-center p-6 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                                <p className="text-sm text-gray-500 text-center italic max-w-xs">
                                                    "Esta foto será usada para identificar vocês no mural de recados e outras áreas do site."
                                                </p>
                                            </div>
                                        </div>

                                        <div className="grid md:grid-cols-2 gap-6">
                                            <FormField
                                                control={form.control}
                                                name="cover_image_mobile"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <ImageUpload
                                                            label="Capa Mobile (1:1)"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            aspectRatio="square"
                                                            helperText="Ideal para smartphones"
                                                        />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="cover_image_desktop"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <ImageUpload
                                                            label="Capa Desktop (Widescreen)"
                                                            value={field.value}
                                                            onChange={field.onChange}
                                                            aspectRatio="wide"
                                                            helperText="Ideal para computadores"
                                                        />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="brand_color"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Cor de Destaque</FormLabel>
                                                    <div className="flex items-center gap-3">
                                                        <FormControl>
                                                            <Input
                                                                type="color"
                                                                {...field}
                                                                className="w-20 h-10 p-1 cursor-pointer"
                                                            />
                                                        </FormControl>
                                                        <span className="text-sm text-gray-500 font-mono uppercase">{field.value}</span>
                                                    </div>
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="gallery_images"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Galeria de Fotos do Casal (Até 5 fotos)</FormLabel>
                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                        {field.value?.map((url, index) => (
                                                            <div key={index} className="relative">
                                                                <ImageUpload
                                                                    value={url}
                                                                    onChange={(newUrl) => {
                                                                        const newGallery = [...(field.value || [])];
                                                                        if (newUrl) {
                                                                            newGallery[index] = newUrl;
                                                                        } else {
                                                                            newGallery.splice(index, 1);
                                                                        }
                                                                        field.onChange(newGallery);
                                                                    }}
                                                                    aspectRatio="square"
                                                                />
                                                                <div className="absolute top-1 left-1 bg-black/50 text-white text-xs px-2 py-0.5 rounded">
                                                                    {index + 1}
                                                                </div>
                                                            </div>
                                                        ))}

                                                        {(!field.value || field.value.length < 5) && (
                                                            <ImageUpload
                                                                label={`Adicionar Foto`}
                                                                value={null}
                                                                onChange={(newUrl) => {
                                                                    if (newUrl) {
                                                                        field.onChange([...(field.value || []), newUrl]);
                                                                    }
                                                                }}
                                                                aspectRatio="square"
                                                            />
                                                        )}
                                                    </div>
                                                    <FormDescription>Essas fotos aparecerão no carrossel da página inicial.</FormDescription>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />

                                        <FormField
                                            control={form.control}
                                            name="couple_story"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>História do Casal</FormLabel>
                                                    <FormControl>
                                                        <Textarea
                                                            placeholder="Conte como vocês se conheceram..."
                                                            rows={6}
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* --- TAB: CERIMÔNIA --- */}
                            <TabsContent value="ceremony">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <MapPin className="h-5 w-5 text-blue-500" />
                                            Cerimônia Religiosa / Civil
                                        </CardTitle>
                                        <CardDescription>Onde será o "Sim"?</CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-3 gap-4">
                                            <div className="col-span-2">
                                                <FormField
                                                    control={form.control}
                                                    name="ceremony_location_name"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel>Nome do Local</FormLabel>
                                                            <FormControl>
                                                                <Input placeholder="Ex: Igreja Matriz" {...field} />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <FormField
                                                control={form.control}
                                                name="ceremony_time"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Horário</FormLabel>
                                                        <FormControl>
                                                            <Input type="time" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="ceremony_address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Endereço Completo</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Rua, Número, Bairro, Cidade" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />

                                        <div className="pt-4 border-t my-4">
                                            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-100 mb-4">
                                                <div className="space-y-0.5">
                                                    <FormLabel className="text-base">Teremos Festa / Recepção?</FormLabel>
                                                    <FormDescription>
                                                        Ative se houver comemoração após a cerimônia.
                                                    </FormDescription>
                                                </div>
                                                <FormField
                                                    control={form.control}
                                                    name="has_party"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormControl>
                                                                <Switch
                                                                    checked={field.value}
                                                                    onCheckedChange={field.onChange}
                                                                />
                                                            </FormControl>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <FormField
                                            control={form.control}
                                            name="ceremony_image"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <ImageUpload
                                                        label="Foto do Local (Opcional)"
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        aspectRatio="video"
                                                    />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* --- TAB: FESTA --- */}
                            <TabsContent value="party">
                                <Card>
                                    <CardHeader>
                                        <CardTitle className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-orange-500" />
                                            Festa e Comemoração
                                        </CardTitle>
                                        <CardDescription>
                                            Detalhes da recepção. Certifique-se de preencher se a opção "Teremos Festa" estiver ativa.
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <FormField
                                                control={form.control}
                                                name="party_date"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Dia da Festa (Se diferente)</FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                type="date"
                                                                min={new Date().toISOString().split("T")[0]}
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={form.control}
                                                name="party_time"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Horário da Festa</FormLabel>
                                                        <FormControl>
                                                            <Input type="time" {...field} />
                                                        </FormControl>
                                                    </FormItem>
                                                )}
                                            />
                                        </div>
                                        <FormField
                                            control={form.control}
                                            name="party_location_name"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Nome do Local da Festa</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ex: Buffet Splendore" {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="party_address"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>Endereço da Festa</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Rua, Número..." {...field} />
                                                    </FormControl>
                                                </FormItem>
                                            )}
                                        />
                                        <div className="h-4" /> {/* Spacer */}
                                        <FormField
                                            control={form.control}
                                            name="party_image"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <ImageUpload
                                                        label="Foto do Salão (Opcional)"
                                                        value={field.value}
                                                        onChange={field.onChange}
                                                        aspectRatio="video"
                                                    />
                                                </FormItem>
                                            )}
                                        />
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        <div className="sticky bottom-0 bg-white/90 backdrop-blur p-4 border rounded-xl shadow-lg flex justify-end gap-3 z-10">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={isSaving}
                                onClick={() => navigate('/dashboard')}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSaving}
                                className="bg-pink-500 hover:bg-pink-600 min-w-[150px]"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    "Salvar Tudo"
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
};

export default WeddingListSettings;

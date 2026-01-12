import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Loader2, Plus, Gift as GiftIcon, ArrowLeft, Sparkles, Wand2 } from "lucide-react";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { ADMIN_MESSAGES } from "@/constants/messages";
import GiftEditForm from "@/components/gifts/GiftEditForm";
import ConfirmDialog from "@/components/ui/confirm-dialog";
import { useSession } from "@/components/SessionContextProvider";
import type { Gift, WeddingList } from "@/types";

const Gifts = () => {
    const { user, isLoading: isSessionLoading } = useSession();
    const [gifts, setGifts] = useState<Gift[]>([]);
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [isLoadingGifts, setIsLoadingGifts] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingGift, setEditingGift] = useState<Gift | undefined>(undefined);
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false);
    const [giftToDelete, setGiftToDelete] = useState<string | null>(null);
    const navigate = useNavigate();

    const fetchWeddingList = useCallback(async () => {
        if (!user?.id) return null;

        const { data, error } = await supabase
            .from("wedding_lists")
            .select("*")
            .eq("user_id", user.id)
            .single();

        if (error && error.code !== "PGRST116") {
            showUserError(ADMIN_MESSAGES.error.LOAD_LIST_FAILED, error);
            return null;
        }

        return data as WeddingList | null;
    }, [user]);

    const fetchGifts = useCallback(async (listId: string) => {
        setIsLoadingGifts(true);

        const { data, error } = await supabase
            .from("gifts")
            .select("*")
            .eq("wedding_list_id", listId)
            .order("created_at", { ascending: false });

        if (error) {
            showUserError(ADMIN_MESSAGES.error.LOAD_GIFTS_FAILED, error);
            setGifts([]);
        } else {
            setGifts(data as Gift[]);
        }

        setIsLoadingGifts(false);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            if (!isSessionLoading && user) {
                const list = await fetchWeddingList();
                setWeddingList(list);

                if (list) {
                    await fetchGifts(list.id);
                } else {
                    setIsLoadingGifts(false);
                }
            } else if (!isSessionLoading && !user) {
                navigate("/login");
            }
        };

        loadData();
    }, [user, isSessionLoading, fetchWeddingList, fetchGifts, navigate]);

    const handleCreateGift = () => {
        setEditingGift(undefined);
        setIsModalOpen(true);
    };

    const handleEditGift = (gift: Gift) => {
        setEditingGift(gift);
        setIsModalOpen(true);
    };

    const handleSaveGift = (savedGift: Gift, createAnother: boolean = false) => {
        if (editingGift) {
            setGifts(prev => prev.map(g => g.id === savedGift.id ? savedGift : g));
            showSuccess(ADMIN_MESSAGES.success.GIFT_UPDATED);
            setIsModalOpen(false);
            setEditingGift(undefined);
        } else {
            setGifts(prev => [savedGift, ...prev]);
            showSuccess(ADMIN_MESSAGES.success.GIFT_CREATED);

            if (createAnother) {
                // Keep modal open but clear editing state for new gift
                setEditingGift(undefined);
            } else {
                setIsModalOpen(false);
                setEditingGift(undefined);
            }
        }
    };

    const handleConfirmDelete = (id: string) => {
        setGiftToDelete(id);
        setIsConfirmDeleteOpen(true);
    };

    const handleDeleteGift = async (confirmed: boolean) => {
        setIsConfirmDeleteOpen(false);
        if (!confirmed || !giftToDelete) {
            setGiftToDelete(null);
            return;
        }

        const giftToDeleteData = gifts.find(g => g.id === giftToDelete);

        // Delete image from storage if exists
        if (giftToDeleteData?.image_url) {
            const imagePath = giftToDeleteData.image_url.split("gift-images/")[1];
            if (imagePath) {
                await supabase.storage.from("gift-images").remove([imagePath]);
            }
        }

        const { error } = await supabase
            .from("gifts")
            .delete()
            .eq("id", giftToDelete);

        if (error) {
            showUserError(ADMIN_MESSAGES.error.DELETE_GIFT_FAILED, error);
        } else {
            setGifts(prev => prev.filter(g => g.id !== giftToDelete));
            showSuccess(ADMIN_MESSAGES.success.GIFT_DELETED);
        }

        setGiftToDelete(null);
    };

    const getPriorityBadge = (priority: string) => {
        switch (priority) {
            case "high":
                return <Badge className="bg-red-100 text-red-800">Alta</Badge>;
            case "medium":
                return <Badge className="bg-yellow-100 text-yellow-800">Média</Badge>;
            case "low":
                return <Badge className="bg-green-100 text-green-800">Baixa</Badge>;
            default:
                return <Badge variant="outline">-</Badge>;
        }
    };

    const getCategoryLabel = (category: string | null) => {
        const categories: Record<string, string> = {
            cozinha: "Cozinha",
            quarto: "Quarto",
            banheiro: "Banheiro",
            sala: "Sala",
            decoracao: "Decoração",
            eletrodomesticos: "Eletrodomésticos",
            eletronicos: "Eletrônicos",
            experiencias: "Experiências",
            outros: "Outros",
        };
        return categories[category || ""] || category || "-";
    };

    if (isSessionLoading || isLoadingGifts) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
                <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
            </div>
        );
    }

    if (!weddingList) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex items-center justify-center p-6">
                <div className="text-center max-w-md">
                    <GiftIcon className="h-16 w-16 text-pink-300 mx-auto mb-4" />
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        Configure sua Lista Primeiro
                    </h2>
                    <p className="text-gray-600 mb-6">
                        Antes de adicionar presentes, você precisa configurar as informações da sua lista de casamento.
                    </p>
                    <Button
                        onClick={() => navigate("/minha-lista")}
                        className="bg-pink-500 hover:bg-pink-600"
                    >
                        Configurar Lista
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 p-6">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate("/dashboard")}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Gerenciar Presentes</h1>
                            <p className="text-sm md:text-base text-gray-600">
                                {weddingList.bride_name} & {weddingList.groom_name}
                            </p>
                        </div>
                    </div>
                    <Button
                        onClick={handleCreateGift}
                        className="w-full md:w-auto bg-pink-500 hover:bg-pink-600"
                    >
                        <Plus className="h-4 w-4 mr-2" />
                        Novo Presente
                    </Button>
                </div>

                {/* Gifts List */}
                {gifts.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 text-center border-2 border-dashed border-pink-200">
                        <div className="bg-gradient-to-br from-pink-100 to-purple-100 w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto mb-6">
                            <Wand2 className="h-10 w-10 md:h-12 md:w-12 text-pink-500" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-3">
                            Sua lista está vazia ✨
                        </h3>
                        <p className="text-gray-600 mb-2 max-w-md mx-auto">
                            Comece a adicionar seus sonhos agora!
                        </p>
                        <p className="text-sm text-gray-400 mb-8">
                            Cada presente que você cadastrar aparecerá para seus convidados.
                        </p>
                        <Button
                            onClick={handleCreateGift}
                            size="lg"
                            className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white px-8"
                        >
                            <Sparkles className="h-5 w-5 mr-2" />
                            Criar Primeiro Presente
                        </Button>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-100">
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-gray-50">
                                    <TableRow>
                                        <TableHead className="min-w-[200px]">Presente</TableHead>
                                        <TableHead>Preço</TableHead>
                                        <TableHead className="text-center">Qtd.</TableHead>
                                        <TableHead className="hidden md:table-cell">Categoria</TableHead>
                                        {/* <TableHead className="hidden md:table-cell">Prioridade</TableHead> */}
                                        <TableHead className="hidden md:table-cell">Recebidos</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {gifts.map((gift) => (
                                        <TableRow key={gift.id} className="hover:bg-gray-50">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-3">
                                                    {gift.image_url ? (
                                                        <img
                                                            src={gift.image_url}
                                                            alt={gift.name}
                                                            className="w-10 h-10 object-cover rounded-md flex-shrink-0"
                                                        />
                                                    ) : (
                                                        <div className="w-10 h-10 bg-pink-100 rounded-md flex items-center justify-center flex-shrink-0">
                                                            <GiftIcon className="h-5 w-5 text-pink-400" />
                                                        </div>
                                                    )}
                                                    <div className="min-w-0">
                                                        <p className="font-medium truncate max-w-[150px] md:max-w-[200px]">{gift.name}</p>
                                                        {gift.description && (
                                                            <p className="text-xs text-gray-500 truncate max-w-[150px] md:max-w-[200px] hidden sm:block">
                                                                {gift.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                R$ {gift.price.toFixed(2)}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {gift.quantity_total}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {getCategoryLabel(gift.category)}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                {getPriorityBadge(gift.priority)}
                                            </TableCell>
                                            <TableCell className="hidden md:table-cell">
                                                <span className="text-sm">
                                                    {gift.quantity_reserved} / {gift.quantity_total}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleEditGift(gift)}
                                                        className="text-gray-600 hover:text-pink-500"
                                                        title="Editar"
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleConfirmDelete(gift.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        title="Excluir"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>

                        {/* Mobile Cards */}
                        <div className="md:hidden divide-y divide-gray-100">
                            {gifts.map((gift) => (
                                <div key={gift.id} className="p-4 flex items-start gap-3">
                                    {gift.image_url ? (
                                        <img
                                            src={gift.image_url}
                                            alt={gift.name}
                                            className="w-16 h-16 object-cover rounded-md flex-shrink-0"
                                        />
                                    ) : (
                                        <div className="w-16 h-16 bg-pink-100 rounded-md flex items-center justify-center flex-shrink-0">
                                            <GiftIcon className="h-8 w-8 text-pink-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <h4 className="font-semibold text-gray-800 truncate pr-2">{gift.name}</h4>
                                            <div className="flex gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-gray-500"
                                                    onClick={() => handleEditGift(gift)}
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                        <p className="text-pink-600 font-bold mb-1">R$ {gift.price.toFixed(2)}</p>
                                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-2">
                                            <span className="bg-gray-100 px-2 py-0.5 rounded">Qtd: {gift.quantity_total}</span>
                                            <span className="bg-gray-100 px-2 py-0.5 rounded">{getCategoryLabel(gift.category)}</span>
                                            {gift.quantity_reserved > 0 && (
                                                <span className="bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded">Reserved: {gift.quantity_reserved}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-end pt-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleConfirmDelete(gift.id)}
                                                className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                            >
                                                <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Edit Modal */}
                <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                    <DialogContent className="w-[95vw] sm:w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-pink-500" />
                                {editingGift ? "Editar Presente" : "Novo Presente"}
                            </DialogTitle>
                        </DialogHeader>
                        <GiftEditForm
                            key={editingGift?.id || 'new-' + gifts.length}
                            initialData={editingGift}
                            weddingListId={weddingList.id}
                            onSave={handleSaveGift}
                            onCancel={() => setIsModalOpen(false)}
                        />
                    </DialogContent>
                </Dialog>

                {/* Delete Confirmation */}
                <ConfirmDialog
                    isOpen={isConfirmDeleteOpen}
                    onClose={handleDeleteGift}
                    title="Excluir Presente"
                    description="Tem certeza que deseja excluir este presente? Esta ação é irreversível."
                    confirmText="Excluir"
                    isDestructive
                />
            </div>
        </div>
    );
};

export default Gifts;

"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Gift, WeddingList } from "@/types";
import { showError, showSuccess, showUserError } from "@/utils/toast";
import { GUEST_MESSAGES, VALIDATION_MESSAGES } from "@/constants/messages";
import { Loader2, Heart, Gift as GiftIcon, ArrowLeft } from "lucide-react";
import CheckoutForm, { CheckoutFormRef } from "@/components/checkout/CheckoutForm";
import CreditCardForm, { CreditCardFormRef } from "@/components/checkout/CreditCardForm";
import FixedBottomBar from "@/components/checkout/FixedBottomBar";
import PixPaymentModal from "@/components/checkout/PixPaymentModal";
import { useMetaTrackingData } from "@/hooks/use-meta-tracking-data";
import { trackInitiateCheckout } from "@/utils/metaPixel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

// Platform fee percentage (same as in GiftEditForm)
const PLATFORM_FEE_PERCENT = 5;

const GiftCheckout = () => {
    const { giftId } = useParams<{ giftId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const metaTrackingData = useMetaTrackingData();

    const [gift, setGift] = useState<Gift | null>(null);
    const [weddingList, setWeddingList] = useState<WeddingList | null>(null);
    const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPixModalOpen, setIsPixModalOpen] = useState(false);
    const [pixDetails, setPixDetails] = useState<any>(null);
    const [asaasPaymentId, setAsaasPaymentId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [orderId, setOrderId] = useState<string | null>(null);
    const [hasTriggeredInitiateCheckout, setHasTriggeredInitiateCheckout] = useState(false);
    const [quantity, setQuantity] = useState(1);
    // Guest identification by phone
    const [matchedGuest, setMatchedGuest] = useState<{
        id: string;
        name: string;
        group_name: string;
        envelope_id: string;
    } | null>(null);
    const [isLookingUpGuest, setIsLookingUpGuest] = useState(false);

    const checkoutFormRef = useRef<CheckoutFormRef>(null);
    const creditCardFormRef = useRef<CreditCardFormRef>(null);

    useEffect(() => {
        fetchGiftData();
    }, [giftId]);

    const fetchGiftData = async () => {
        if (!giftId) {
            showUserError(GUEST_MESSAGES.error.GIFT_NOT_FOUND);
            navigate("/");
            return;
        }

        setIsLoading(true);

        try {
            // Fetch gift
            const { data: giftData, error: giftError } = await supabase
                .from("gifts")
                .select("*")
                .eq("id", giftId)
                .single();

            if (giftError || !giftData) {
                showUserError(GUEST_MESSAGES.error.GIFT_NOT_FOUND, giftError);
                navigate("/");
                return;
            }

            setGift(giftData);

            // Fetch wedding list for context
            const { data: listData } = await supabase
                .from("wedding_lists")
                .select("*")
                .eq("id", giftData.wedding_list_id)
                .single();

            if (listData) {
                setWeddingList(listData);
            }
        } catch (error: any) {
            showUserError(GUEST_MESSAGES.error.LOAD_GIFT_FAILED, error);
            navigate("/");
        } finally {
            setIsLoading(false);
        }
    };

    const totalPrice = useMemo(() => {
        if (!gift) return 0;
        return gift.price * quantity;
    }, [gift, quantity]);

    const availableQuantity = useMemo(() => {
        if (!gift) return 0;
        return gift.quantity_total - (gift.quantity_reserved || 0) - (gift.quantity_purchased || 0);
    }, [gift]);

    const isCotas = useMemo(() => {
        if (!gift) return false;
        return gift.quantity_total > 1;
    }, [gift]);

    const handleEmailVerified = (email: string) => {
        if (hasTriggeredInitiateCheckout || !gift) return;

        console.log("🎯 Triggering InitiateCheckout for Gift - Email:", email);

        trackInitiateCheckout(
            totalPrice,
            "BRL",
            [gift.id],
            1,
            {
                email: email,
                phone: null,
                firstName: null,
                lastName: null,
            }
        );

        setHasTriggeredInitiateCheckout(true);
    };

    // Lookup guest by phone number
    const handlePhoneLookup = async (phone: string) => {
        if (!phone || phone.replace(/\D/g, '').length < 10 || !gift?.wedding_list_id) {
            setMatchedGuest(null);
            return;
        }

        setIsLookingUpGuest(true);
        try {
            const { data, error } = await supabase.functions.invoke('lookup-guest-by-phone', {
                body: {
                    phone,
                    wedding_list_id: gift.wedding_list_id
                }
            });

            if (!error && data?.found && data?.guest) {
                setMatchedGuest(data.guest);
                showSuccess(`🎉 Encontramos você, ${data.guest.name} da ${data.guest.group_name}!`);
            } else {
                setMatchedGuest(null);
            }
        } catch (err) {
            console.error('Error looking up guest:', err);
            setMatchedGuest(null);
        } finally {
            setIsLookingUpGuest(false);
        }
    };

    // Update guest after successful purchase
    const updateGuestPurchaseStatus = async (guestId: string | null, guestName: string, guestPhone: string) => {
        try {
            await supabase.functions.invoke('update-guest-purchase', {
                body: {
                    guest_id: guestId,
                    wedding_list_id: gift?.wedding_list_id,
                    guest_name: guestName,
                    guest_phone: guestPhone
                }
            });
            console.log('Guest purchase status updated');
        } catch (err) {
            console.error('Error updating guest purchase status:', err);
        }
    };

    const handleSubmit = async () => {
        if (!gift) {
            showError(GUEST_MESSAGES.error.GIFT_NOT_FOUND);
            return;
        }

        const checkoutFormValid = await checkoutFormRef.current?.submitForm();
        if (!checkoutFormValid) {
            showError(VALIDATION_MESSAGES.REQUIRED_FIELDS);
            return;
        }

        const checkoutFormData = checkoutFormRef.current?.getValues();
        if (!checkoutFormData) {
            showError(GUEST_MESSAGES.error.GENERIC);
            return;
        }

        let creditCardData = null;
        if (paymentMethod === "CREDIT_CARD") {
            const creditCardFormValid = await creditCardFormRef.current?.submitForm();
            if (!creditCardFormValid) {
                showError(VALIDATION_MESSAGES.CARD_FIELDS_REQUIRED);
                return;
            }
            creditCardData = creditCardFormRef.current?.getValues();
        }

        setIsSubmitting(true);

        try {
            // Create gift reservation first
            const { data: reservation, error: reservationError } = await supabase
                .from("gift_reservations")
                .insert({
                    gift_id: gift.id,
                    guest_name: checkoutFormData.name,
                    guest_email: checkoutFormData.email,
                    guest_phone: checkoutFormData.whatsapp,
                    quantity: quantity,
                    status: "reserved",
                })
                .select()
                .single();

            if (reservationError) {
                showUserError(GUEST_MESSAGES.error.RESERVATION_FAILED, reservationError);
                return;
            }

            // Use existing payment function with gift-specific data
            const payload: any = {
                name: checkoutFormData.name,
                email: checkoutFormData.email,
                cpf: checkoutFormData.cpf,
                whatsapp: checkoutFormData.whatsapp,
                // For gifts, we pass the gift info differently
                giftId: gift.id,
                giftName: gift.name,
                giftReservationId: reservation.id,
                totalPrice: totalPrice,
                weddingListId: gift.wedding_list_id,
                quantity: quantity,
                paymentMethod,
                isGiftPayment: true, // Flag to identify gift payments
                metaTrackingData: {
                    ...metaTrackingData,
                    event_source_url: window.location.href,
                },
            };

            if (paymentMethod === "CREDIT_CARD" && creditCardData) {
                payload.creditCard = creditCardData;
            }

            const { data, error } = await supabase.functions.invoke("create-asaas-payment", {
                body: payload,
            });

            if (error) {
                // Rollback reservation on payment error
                await supabase.from("gift_reservations").delete().eq("id", reservation.id);
                showUserError(GUEST_MESSAGES.error.PAYMENT_FAILED, error);
                return;
            }

            if (data?.error) {
                await supabase.from("gift_reservations").delete().eq("id", reservation.id);
                showUserError(GUEST_MESSAGES.error.PAYMENT_FAILED, { message: data.error });
                return;
            }

            // Update reservation with payment info
            await supabase
                .from("gift_reservations")
                .update({
                    status: paymentMethod === "PIX" ? "reserved" : "reserved",
                })
                .eq("id", reservation.id);

            if (paymentMethod === "PIX") {
                setPixDetails(data);
                setAsaasPaymentId(data.id);
                setOrderId(reservation.id);
                setIsPixModalOpen(true);
            } else if (paymentMethod === "CREDIT_CARD") {
                if (data.status === "CONFIRMED" || data.status === "RECEIVED") {
                    // Update reservation and gift quantities
                    await supabase
                        .from("gift_reservations")
                        .update({ status: "purchased" })
                        .eq("id", reservation.id);

                    await supabase
                        .from("gifts")
                        .update({
                            quantity_purchased: (gift.quantity_purchased || 0) + quantity
                        })
                        .eq("id", gift.id);

                    // Update guest purchase status
                    await updateGuestPurchaseStatus(
                        matchedGuest?.id || null,
                        checkoutFormData.name,
                        checkoutFormData.whatsapp
                    );

                    showSuccess(GUEST_MESSAGES.success.GIFT_SENT);
                    navigate("/confirmacao", {
                        state: {
                            orderId: reservation.id,
                            totalPrice: totalPrice,
                            giftName: gift.name,
                            coupleName: weddingList ? `${weddingList.bride_name} & ${weddingList.groom_name}` : null,
                        }
                    });
                } else {
                    showSuccess(GUEST_MESSAGES.success.ORDER_CREATED);
                    navigate("/processando-pagamento");
                }
            }
        } catch (err: any) {
            showUserError(GUEST_MESSAGES.error.GENERIC, err);
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value);
    };

    const handleGoBack = () => {
        if (weddingList?.slug) {
            navigate(`/lista/${weddingList.slug}`);
        } else {
            navigate(-1);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
                <div className="text-center">
                    <Heart className="h-12 w-12 text-pink-500 animate-pulse mx-auto mb-4" />
                    <p className="text-gray-600">Carregando presente...</p>
                </div>
            </div>
        );
    }

    if (!gift) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50">
                <div className="text-center">
                    <GiftIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-xl text-gray-600">Presente não encontrado.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-purple-50 flex flex-col">
            {/* Header */}
            <header className="bg-white shadow-sm sticky top-0 z-40">
                <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={handleGoBack}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-lg font-semibold text-gray-800">Presentear</h1>
                        {weddingList && (
                            <p className="text-sm text-gray-500">
                                {weddingList.bride_name} & {weddingList.groom_name}
                            </p>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-1 container mx-auto p-4 md:p-8 max-w-2xl">
                <div className="space-y-6 pb-6">
                    {/* Gift Card */}
                    <Card className="overflow-hidden shadow-lg">
                        <div className="flex flex-col sm:flex-row">
                            {/* Image */}
                            <div className="sm:w-1/3 aspect-square bg-gradient-to-br from-pink-100 to-purple-100">
                                {gift.image_url ? (
                                    <img
                                        src={gift.image_url}
                                        alt={gift.name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                        <GiftIcon className="h-16 w-16 text-pink-300" />
                                    </div>
                                )}
                            </div>

                            {/* Details */}
                            <CardContent className="flex-1 p-4 sm:p-6">
                                <div className="flex items-start justify-between mb-2">
                                    <h2 className="text-xl font-bold text-gray-800">{gift.name}</h2>
                                    {isCotas && (
                                        <Badge className="bg-green-500 text-white">Cotas</Badge>
                                    )}
                                </div>

                                {gift.description && (
                                    <p className="text-gray-600 text-sm mb-4">{gift.description}</p>
                                )}

                                {/* Progress for cotas */}
                                {isCotas && (
                                    <div className="mb-4">
                                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                                            <span>{formatCurrency(gift.price * (gift.quantity_purchased || 0))} arrecadados</span>
                                            <span>{formatCurrency(gift.price * gift.quantity_total)}</span>
                                        </div>
                                        <Progress
                                            value={((gift.quantity_purchased || 0) / gift.quantity_total) * 100}
                                            className="h-2"
                                        />
                                    </div>
                                )}

                                <div className="flex items-center justify-between">
                                    <span className="text-2xl font-bold text-pink-600">
                                        {formatCurrency(gift.price)}
                                    </span>

                                    {isCotas && availableQuantity > 1 && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm text-gray-500">Qtd:</span>
                                            <select
                                                value={quantity}
                                                onChange={(e) => setQuantity(Number(e.target.value))}
                                                className="border rounded px-2 py-1 text-sm"
                                            >
                                                {Array.from({ length: Math.min(availableQuantity, 10) }, (_, i) => i + 1).map((n) => (
                                                    <option key={n} value={n}>
                                                        {n}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                </div>

                                {quantity > 1 && (
                                    <p className="text-sm text-gray-500 mt-2">
                                        Total: <span className="font-semibold text-pink-600">{formatCurrency(totalPrice)}</span>
                                    </p>
                                )}
                            </CardContent>
                        </div>
                    </Card>

                    {/* Checkout Form */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Seus Dados</h2>
                        <p className="text-sm text-gray-500 mb-4">
                            Preencha seus dados para enviar o presente
                        </p>

                        {/* Matched Guest Banner */}
                        {matchedGuest && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                                <div className="flex items-center gap-2 text-green-700">
                                    <span className="text-2xl">🎉</span>
                                    <div>
                                        <p className="font-semibold">Encontramos você!</p>
                                        <p className="text-sm">{matchedGuest.name} da {matchedGuest.group_name}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isLookingUpGuest && (
                            <div className="text-center text-gray-500 text-sm mb-4">
                                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                                Buscando seus dados...
                            </div>
                        )}

                        <CheckoutForm
                            ref={checkoutFormRef}
                            onSubmit={() => { }}
                            isLoading={isSubmitting}
                            onEmailVerified={handleEmailVerified}
                            onPhoneLookup={handlePhoneLookup}
                        />
                    </div>

                    {/* Payment Method */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">Método de Pagamento</h3>
                        <Tabs value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as "PIX" | "CREDIT_CARD")}>
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="PIX">PIX</TabsTrigger>
                                <TabsTrigger value="CREDIT_CARD">Cartão de Crédito</TabsTrigger>
                            </TabsList>
                            <TabsContent value="PIX" className="mt-4">
                                <p className="text-sm text-gray-600">
                                    Você receberá um QR Code para pagamento via PIX após finalizar.
                                </p>
                            </TabsContent>
                            <TabsContent value="CREDIT_CARD" className="mt-4">
                                <CreditCardForm
                                    ref={creditCardFormRef}
                                    isLoading={isSubmitting}
                                    totalPrice={totalPrice}
                                />
                            </TabsContent>
                        </Tabs>
                    </div>

                    {/* Order Summary */}
                    <Card className="shadow-lg">
                        <CardContent className="p-6">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Resumo</h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-gray-600">{gift.name} {quantity > 1 && `(x${quantity})`}</span>
                                    <span className="font-medium">{formatCurrency(totalPrice)}</span>
                                </div>
                                <div className="border-t pt-2 mt-2 flex justify-between font-semibold text-lg">
                                    <span>Total</span>
                                    <span className="text-pink-600">{formatCurrency(totalPrice)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Info */}
                    <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
                        <p className="text-xs text-pink-700 text-center leading-relaxed">
                            💝 O valor será enviado diretamente para o casal.
                            Eles receberão uma notificação do seu presente!
                        </p>
                    </div>

                    {/* Footer with Brand */}
                    <div className="text-center py-4">
                        <div className="flex justify-center mb-2">
                            <img src="/logo.png" alt="DuetLove" className="h-8 object-contain" />
                        </div>
                        <p className="text-xs text-gray-400">
                            © 2025 DuetLove. Todos os direitos reservados.
                        </p>
                    </div>

                    {/* Bottom Spacing */}
                    <div className="h-24 md:h-16"></div>
                </div>
            </main>

            <FixedBottomBar
                totalPrice={totalPrice}
                isSubmitting={isSubmitting}
                onSubmit={handleSubmit}
                buttonText="Enviar Presente 🎁"
            />

            <PixPaymentModal
                isOpen={isPixModalOpen}
                onClose={() => setIsPixModalOpen(false)}
                orderId={orderId || ""}
                pixDetails={pixDetails}
                totalPrice={totalPrice}
                asaasPaymentId={asaasPaymentId || ""}
            />
        </div>
    );
};

export default GiftCheckout;

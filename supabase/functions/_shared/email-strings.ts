/**
 * Email Strings / Translations
 * 
 * Centralized text content for all emails.
 * Edit this file to change email wording or add translations.
 * 
 * Future: Add support for multiple languages by creating a structure like:
 * const strings = { pt: {...}, en: {...}, es: {...} }
 */

export const EMAIL_STRINGS = {
    // ==================== GIFT RECEIPT (for guests) ====================
    giftReceipt: {
        subject: (coupleNames: string) => `🎁 Recibo do seu presente para ${coupleNames}`,

        greeting: (guestName: string) => `Olá, <strong>${guestName}</strong>!`,

        confirmationMessage: `Seu pagamento foi confirmado e os noivos já foram avisados. Muito obrigado por fazer parte deste momento especial!`,

        labels: {
            gift: 'Presente:',
            amount: 'Valor:',
            status: 'Status:',
            confirmed: '✅ Confirmado',
        },

        footer: (coupleNames: string) =>
            `Este e-mail serve como comprovante do seu presente para ${coupleNames}.`,

        headerTitle: 'Obrigado pelo presente!',
    },

    // ==================== FIRST GIFT (for couple) ====================
    firstGift: {
        subject: `🎉 Seu primeiro presente chegou!`,

        headerTitle: (coupleNames: string) => `Parabéns, ${coupleNames}!`,
        headerSubtitle: 'Seu primeiro presente chegou!',

        giftFrom: (guestName: string) => `<strong>${guestName}</strong>`,
        giftAction: 'acabou de presentear vocês com',

        encouragement: `Este é só o começo de uma jornada incrível. 💕<br>Compartilhe sua lista para receber mais presentes!`,

        ctaButton: 'Ver no Painel',
    },

    // ==================== DAILY DIGEST (for couple) ====================
    dailyDigest: {
        subject: {
            prefix: '❤️ Resumo do dia:',
            presences: (count: number) =>
                `${count} nova${count > 1 ? 's' : ''} presença${count > 1 ? 's' : ''}`,
            gifts: (amount: string) => `${amount} em presentes`,
            messages: (count: number) =>
                `${count} mensage${count > 1 ? 'ns' : 'm'}`,
        },

        headerTitle: '❤️ Resumo do Dia',

        sections: {
            rsvp: {
                title: (count: number) => `🎉 Novos Confirmados (${count})`,
                companions: (count: number) => ` (+${count})`,
            },
            gifts: {
                title: (amount: string) => `🎁 Novos Presentes (${amount})`,
                item: (giftName: string, amount: string, guestName: string) =>
                    `${giftName} (${amount}) - por ${guestName}`,
            },
            messages: {
                title: (count: number) => `💬 Novas Mensagens (${count})`,
                description: (count: number) =>
                    `${count} novo${count > 1 ? 's' : ''} recado${count > 1 ? 's' : ''} no mural`,
            },
        },

        ctaButton: 'Ver Detalhes no Painel',

        footerNote: 'Operação Casamento • Enviado às 20h',
    },

    // ==================== COMMON ====================
    common: {
        footerBrand: 'Operação Casamento • Feito com ❤️',
    },
};

/**
 * Format currency in Brazilian Real
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

/**
 * Format quantity text
 */
export function formatQuantity(quantity: number): string {
    return quantity > 1 ? ` (${quantity}x)` : '';
}

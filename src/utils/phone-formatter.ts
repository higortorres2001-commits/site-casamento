/**
 * Formats a Brazilian phone number
 * @param phone - Phone number string with or without formatting
 * @returns Formatted phone number
 */
export function formatPhoneNumber(phone: string): string {
    const cleanPhone = phone.replace(/\D/g, '');

    // Mobile: (XX) XXXXX-XXXX
    if (cleanPhone.length === 11) {
        return cleanPhone.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
    }

    // Landline: (XX) XXXX-XXXX
    if (cleanPhone.length === 10) {
        return cleanPhone.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    }

    return phone;
}

/**
 * Removes formatting from phone number (keeps only numbers)
 * @param phone - Formatted phone number
 * @returns Phone with only numbers
 */
export function cleanPhoneNumber(phone: string): string {
    return phone.replace(/\D/g, '');
}

/**
 * Generates a WhatsApp link
 * @param phone - Phone number (with or without formatting)
 * @param message - Optional pre-filled message
 * @returns WhatsApp URL
 */
export function generateWhatsAppLink(phone: string, message?: string): string {
    const cleanPhone = cleanPhoneNumber(phone);

    // Add country code if not present (55 for Brazil)
    const phoneWithCountry = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;

    const baseUrl = `https://wa.me/${phoneWithCountry}`;

    if (message) {
        return `${baseUrl}?text=${encodeURIComponent(message)}`;
    }

    return baseUrl;
}

/**
 * Validates Brazilian phone number format
 * @param phone - Phone number string
 * @returns true if valid format
 */
export function validatePhoneNumber(phone: string): boolean {
    const cleanPhone = cleanPhoneNumber(phone);

    // Must be 10 (landline) or 11 (mobile) digits
    if (cleanPhone.length !== 10 && cleanPhone.length !== 11) {
        return false;
    }

    // DDD (area code) must be between 11 and 99
    const ddd = parseInt(cleanPhone.substring(0, 2));
    if (ddd < 11 || ddd > 99) {
        return false;
    }

    // Mobile numbers start with 9
    if (cleanPhone.length === 11 && cleanPhone.charAt(2) !== '9') {
        return false;
    }

    return true;
}

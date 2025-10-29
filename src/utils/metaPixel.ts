"use client";

import CryptoJS from 'crypto-js';

// Função para hashear dados usando SHA-256
const hashSHA256 = (value: string | null | undefined): string | undefined => {
  if (!value) return undefined;
  // Normalize string to lowercase and remove leading/trailing whitespace
  const normalizedValue = value.trim().toLowerCase();
  return CryptoJS.SHA256(normalizedValue).toString(CryptoJS.enc.Hex);
};

// Função para obter dados do cliente hasheados
const getHashedCustomerData = (email?: string | null, phone?: string | null, firstName?: string | null, lastName?: string | null) => {
  return {
    em: hashSHA256(email),
    ph: hashSHA256(phone),
    fn: hashSHA256(firstName),
    ln: hashSHA256(lastName),
  };
};

// Função para disparar o evento InitiateCheckout
export const trackInitiateCheckout = (
  value: number,
  currency: string,
  content_ids: string[],
  num_items: number,
  customerData: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }
) => {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn("Meta Pixel (fbq) not loaded. InitiateCheckout event not tracked.");
    return;
  }

  const hashedCustomerData = getHashedCustomerData(customerData.email, customerData.phone, customerData.firstName, customerData.lastName);

  window.fbq('track', 'InitiateCheckout', {
    value: value,
    currency: currency,
    content_ids: content_ids,
    num_items: num_items,
  }, {
    eventID: `initiate_checkout_${Date.now()}`, // Unique event ID
    userData: hashedCustomerData,
  });
  console.log("Meta Pixel: InitiateCheckout event tracked.", { value, currency, content_ids, num_items, hashedCustomerData });
};

// Função para disparar o evento Purchase
export const trackPurchase = (
  value: number,
  currency: string,
  order_id: string,
  customerData: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }
) => {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn("Meta Pixel (fbq) not loaded. Purchase event not tracked.");
    return;
  }

  const hashedCustomerData = getHashedCustomerData(customerData.email, customerData.phone, customerData.firstName, customerData.lastName);

  window.fbq('track', 'Purchase', {
    value: value,
    currency: currency,
    order_id: order_id,
  }, {
    eventID: `purchase_${order_id}_${Date.now()}`, // Unique event ID
    userData: hashedCustomerData,
  });
  console.log("Meta Pixel: Purchase event tracked.", { value, currency, order_id, hashedCustomerData });
};
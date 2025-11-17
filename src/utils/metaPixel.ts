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
    console.warn("🚫 Meta Pixel (fbq) not loaded. InitiateCheckout event not tracked.");
    return;
  }

  const hashedCustomerData = getHashedCustomerData(customerData.email, customerData.phone, customerData.firstName, customerData.lastName);

  // 🎯 Log detalhado para debug
  console.log("🎯 Meta Pixel: InitiateCheckout event details:", {
    value,
    currency,
    content_ids,
    num_items,
    customerData: {
      email: customerData.email ? "PROVIDED" : "NOT_PROVIDED",
      phone: customerData.phone ? "PROVIDED" : "NOT_PROVIDED", 
      firstName: customerData.firstName ? "PROVIDED" : "NOT_PROVIDED",
      lastName: customerData.lastName ? "PROVIDED" : "NOT_PROVIDED",
    },
    hashedCustomerData: {
      em: hashedCustomerData.em ? "HASHED" : "NOT_PROVIDED",
      ph: hashedCustomerData.ph ? "HASHED" : "NOT_PROVIDED",
      fn: hashedCustomerData.fn ? "HASHED" : "NOT_PROVIDED",
      ln: hashedCustomerData.ln ? "HASHED" : "NOT_PROVIDED",
    }
  });

  const eventId = `initiate_checkout_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  try {
    window.fbq('track', 'InitiateCheckout', {
      value: value,
      currency: currency,
      content_ids: content_ids,
      num_items: num_items,
    }, {
      eventID: eventId,
      userData: hashedCustomerData,
    });

    console.log("✅ Meta Pixel: InitiateCheckout event tracked successfully.", {
      eventId,
      value,
      currency,
      content_ids,
      num_items,
      hasCustomerData: Object.values(hashedCustomerData).some(v => v !== undefined)
    });
  } catch (error) {
    console.error("❌ Meta Pixel: Error tracking InitiateCheckout event:", error);
  }
};

// Função para disparar o evento Purchase
export const trackPurchase = (
  value: number,
  currency: string,
  order_id: string,
  customerData: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }
) => {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn("🚫 Meta Pixel (fbq) not loaded. Purchase event not tracked.");
    return;
  }

  const hashedCustomerData = getHashedCustomerData(customerData.email, customerData.phone, customerData.firstName, customerData.lastName);

  // 🎯 Log detalhado para debug
  console.log("🎯 Meta Pixel: Purchase event details:", {
    value,
    currency,
    order_id,
    customerData: {
      email: customerData.email ? "PROVIDED" : "NOT_PROVIDED",
      phone: customerData.phone ? "PROVIDED" : "NOT_PROVIDED", 
      firstName: customerData.firstName ? "PROVIDED" : "NOT_PROVIDED",
      lastName: customerData.lastName ? "PROVIDED" : "NOT_PROVIDED",
    },
    hashedCustomerData: {
      em: hashedCustomerData.em ? "HASHED" : "NOT_PROVIDED",
      ph: hashedCustomerData.ph ? "HASHED" : "NOT_PROVIDED",
      fn: hashedCustomerData.fn ? "HASHED" : "NOT_PROVIDED",
      ln: hashedCustomerData.ln ? "HASHED" : "NOT_PROVIDED",
    }
  });

  const eventId = `purchase_${order_id}_${Date.now()}`;

  try {
    window.fbq('track', 'Purchase', {
      value: value,
      currency: currency,
      order_id: order_id,
    }, {
      eventID: eventId,
      userData: hashedCustomerData,
    });

    console.log("✅ Meta Pixel: Purchase event tracked successfully.", {
      eventId,
      value,
      currency,
      order_id,
      hasCustomerData: Object.values(hashedCustomerData).some(v => v !== undefined)
    });
  } catch (error) {
    console.error("❌ Meta Pixel: Error tracking Purchase event:", error);
  }
};

// Função para inicializar o Pixel com dados avançados
export const initializePixelWithUserData = (
  pixelId: string,
  customerData?: { email?: string | null; phone?: string | null; firstName?: string | null; lastName?: string | null }
) => {
  if (typeof window === 'undefined' || !window.fbq) {
    console.warn("🚫 Meta Pixel (fbq) not loaded. Cannot initialize with user data.");
    return;
  }

  if (!customerData) {
    // Inicialização padrão sem dados do usuário
    console.log("🎯 Meta Pixel: Initializing without user data");
    window.fbq('init', pixelId);
    window.fbq('track', 'PageView');
    return;
  }

  const hashedCustomerData = getHashedCustomerData(customerData.email, customerData.phone, customerData.firstName, customerData.lastName);

  // 🎯 Log detalhado para debug
  console.log("🎯 Meta Pixel: Initializing with advanced matching data:", {
    pixelId,
    customerData: {
      email: customerData.email ? "PROVIDED" : "NOT_PROVIDED",
      phone: customerData.phone ? "PROVIDED" : "NOT_PROVIDED", 
      firstName: customerData.firstName ? "PROVIDED" : "NOT_PROVIDED",
      lastName: customerData.lastName ? "PROVIDED" : "NOT_PROVIDED",
    },
    hashedCustomerData: {
      em: hashedCustomerData.em ? "HASHED" : "NOT_PROVIDED",
      ph: hashedCustomerData.ph ? "HASHED" : "NOT_PROVIDED",
      fn: hashedCustomerData.fn ? "HASHED" : "NOT_PROVIDED",
      ln: hashedCustomerData.ln ? "HASHED" : "NOT_PROVIDED",
    }
  });

  try {
    // Inicialização com dados avançados
    window.fbq('init', pixelId, {
      em: hashedCustomerData.em,
      ph: hashedCustomerData.ph,
      fn: hashedCustomerData.fn,
      ln: hashedCustomerData.ln,
    });

    window.fbq('track', 'PageView');
    console.log("✅ Meta Pixel: Initialized successfully with advanced matching data.");
  } catch (error) {
    console.error("❌ Meta Pixel: Error initializing with user data:", error);
  }
};
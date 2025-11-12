import { useEffect } from 'react';

// Hook para inicialização do Pixel
export function usePixelInitialization() {
  useEffect(() => {
    // Inicialização do Meta Pixel
    const initializePixel = () => {
      // Verificar se o Pixel já foi inicializado
      if (window.fbq) {
        return;
      }

      // Inicializar o Pixel
      !function(f,b,e,v,n,t,s)
      {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script',
      'https://connect.facebook.net/en_US/fbevents.js');
      
      // Configurar o Pixel
      fbq('init', 'YOUR_PIXEL_ID'); // Substituir pelo ID real do Pixel
      fbq('track', 'PageView');
    };

    initializePixel();
  }, []);
}

// Hook para tracking de eventos do Pixel
export function usePixelEvents() {
  const trackPurchaseInit = () => {
    if (window.fbq) {
      fbq('track', 'InitiateCheckout');
    }
  };

  const trackPaymentInfo = () => {
    if (window.fbq) {
      fbq('track', 'AddPaymentInfo');
    }
  };

  const trackPurchase = (value?: number, currency?: string) => {
    if (window.fbq) {
      fbq('track', 'Purchase', {
        value: value || 0,
        currency: currency || 'BRL'
      });
    }
  };

  const trackViewContent = (contentName?: string, contentCategory?: string) => {
    if (window.fbq) {
      fbq('track', 'ViewContent', {
        content_name: contentName,
        content_category: contentCategory
      });
    }
  };

  const trackAddToCart = (value?: number, currency?: string) => {
    if (window.fbq) {
      fbq('track', 'AddToCart', {
        value: value || 0,
        currency: currency || 'BRL'
      });
    }
  };

  return {
    trackPurchaseInit,
    trackPaymentInfo,
    trackPurchase,
    trackViewContent,
    trackAddToCart
  };
}

// Declaração global para o Facebook Pixel
declare global {
  interface Window {
    fbq: any;
  }
}
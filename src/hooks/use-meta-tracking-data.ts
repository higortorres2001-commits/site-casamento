"use client";

import { useEffect, useState } from 'react';

interface MetaTrackingData {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  fbp?: string;
  fbc?: string;
  event_source_url?: string; // Adicionado para capturar a URL completa
}

const getCookie = (name: string): string | undefined => {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return undefined;
};

export function useMetaTrackingData(): MetaTrackingData {
  const [trackingData, setTrackingData] = useState<MetaTrackingData>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const data: MetaTrackingData = {};

    // Capture UTM parameters
    data.utm_source = params.get('utm_source') || undefined;
    data.utm_medium = params.get('utm_medium') || undefined;
    data.utm_campaign = params.get('utm_campaign') || undefined;
    data.utm_content = params.get('utm_content') || undefined;
    data.utm_term = params.get('utm_term') || undefined;

    // Capture Meta cookies
    data.fbp = getCookie('_fbp') || undefined;
    data.fbc = getCookie('_fbc') || undefined;

    // Capture the full current URL
    data.event_source_url = window.location.href;

    setTrackingData(data);
  }, []);

  return trackingData;
}
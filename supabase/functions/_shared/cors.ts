/**
 * CORS Configuration for Supabase Edge Functions
 * Restricts access to allowed domains only
 */

const ALLOWED_ORIGINS = [
    'https://medsemestress.com',
    'https://app.medsemestress.com',
    'https://vetsemestresse.com.br',
    'https://app.vetsemestresse.com.br',
];

/**
 * Get CORS headers with origin validation
 * @param origin - The request origin header
 * @returns CORS headers object
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
    const validOrigin = origin && ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

    return {
        'Access-Control-Allow-Origin': validOrigin,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
    };
}

/**
 * Handle OPTIONS preflight request
 * @param req - The incoming request
 * @returns Response for OPTIONS or null if not OPTIONS
 */
export function handleCorsPreflightIfNeeded(req: Request): Response | null {
    if (req.method === 'OPTIONS') {
        const origin = req.headers.get('origin');
        return new Response(null, { headers: getCorsHeaders(origin) });
    }
    return null;
}

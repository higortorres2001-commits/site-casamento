/**
 * CORS Configuration for Supabase Edge Functions
 * Restricts access to allowed domains only
 */

const ALLOWED_ORIGINS = [
    'https://site-casamento-fawn.vercel.app',
    'https://casei.sejatudoqueveiopraser.com.br', // Domínio personalizado do casamento
    'http://localhost:5173', // Desenvolvimento local
    'http://localhost:3000', // Desenvolvimento local
    'http://localhost:8080', // Desenvolvimento local
    'http://localhost:8081', // Desenvolvimento local
];

/**
 * Get CORS headers with origin validation
 * @param origin - The request origin header
 * @returns CORS headers object
 */
export function getCorsHeaders(origin: string | null): Record<string, string> {
    // Se não há origin (webhooks externos como Asaas), permite a requisição
    if (!origin) {
        return {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, asaas-access-token',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Max-Age': '86400',
        };
    }

    // Para requisições do frontend, valida o origin
    let validOrigin = ALLOWED_ORIGINS.includes(origin)
        ? origin
        : ALLOWED_ORIGINS[0];

    // Verifica domínios dinâmicos (wildcards)
    if (!ALLOWED_ORIGINS.includes(origin)) {
        // Permite sejatudooqueveioparaser.com.br e todos os seus subdomínios
        if (origin.match(/^https?:\/\/(?:.+\.)?sejatudooqueveioparaser\.com\.br$/)) {
            validOrigin = origin;
        }
    }

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

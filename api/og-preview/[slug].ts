/**
 * Vercel Edge Function for Dynamic OG Meta Tags
 * 
 * When social media bots (WhatsApp, Facebook, Twitter, etc.) access /lista/{slug},
 * this edge function fetches the wedding list data and returns HTML with
 * correct meta tags for beautiful social previews.
 * 
 * Usage: Vercel rewrites /lista/* to this handler when User-Agent is a bot.
 */

export const config = {
    runtime: 'edge',
};

// Bot user agents that need dynamic meta tags
const BOT_USER_AGENTS = [
    'whatsapp',
    'facebookexternalhit',
    'facebookcatalog',
    'twitterbot',
    'linkedinbot',
    'slackbot',
    'telegrambot',
    'discordbot',
    'pinterest',
    'googlebot',
    'bingbot',
    'yandex',
    'baiduspider',
];

// Check if user agent is a bot
function isBot(userAgent: string | null): boolean {
    if (!userAgent) return false;
    const ua = userAgent.toLowerCase();
    return BOT_USER_AGENTS.some(bot => ua.includes(bot));
}

export default async function handler(request: Request) {
    const url = new URL(request.url);
    const userAgent = request.headers.get('user-agent');

    // Extract slug from URL path
    // URL will be like /api/og-preview/joao-e-maria or direct /lista/joao-e-maria
    const pathParts = url.pathname.split('/').filter(Boolean);
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
        return new Response('Not found', { status: 404 });
    }

    // For non-bots, redirect to actual page (let SPA handle it)
    if (!isBot(userAgent)) {
        return Response.redirect(`${url.origin}/lista/${slug}`, 302);
    }

    try {
        // Fetch wedding list data from Supabase
        const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
        const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            console.error('Supabase credentials not configured');
            return generateBotHtml({
                title: 'DuetLove - Crie sua Lista de Casamento',
                description: 'Crie sua lista de presentes de casamento online. Grátis e fácil de usar!',
                image: `${url.origin}/logo.png`,
                url: url.toString(),
            });
        }

        // Query wedding list by slug
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/wedding_lists?slug=eq.${encodeURIComponent(slug)}&select=bride_name,groom_name,couple_profile_image,cover_image_url,wedding_date,description&is_public=eq.true`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
            }
        );

        if (!response.ok) {
            console.error('Failed to fetch wedding list:', response.status);
            return generateBotHtml({
                title: 'DuetLove - Crie sua Lista de Casamento',
                description: 'Confira a lista de presentes de casamento.',
                image: `${url.origin}/logo.png`,
                url: url.toString(),
            });
        }

        const data = await response.json();

        if (!data || data.length === 0) {
            return generateBotHtml({
                title: 'DuetLove - Lista não encontrada',
                description: 'Esta lista de casamento não foi encontrada.',
                image: `${url.origin}/logo.png`,
                url: url.toString(),
            });
        }

        const weddingList = data[0];

        // Extract first names only
        const brideFirstName = weddingList.bride_name?.split(' ')[0] || weddingList.bride_name;
        const groomFirstName = weddingList.groom_name?.split(' ')[0] || weddingList.groom_name;

        // Build meta values
        const coupleNames = `${brideFirstName} & ${groomFirstName}`;
        const title = coupleNames;
        const description = `Estamos nos casando! 💒✨ Confirme sua presença e confira todos os detalhes do nosso grande dia. Será uma honra tê-lo(a) conosco!`;

        // Prefer couple profile image, fallback to cover image, then default
        const image = weddingList.couple_profile_image
            || weddingList.cover_image_url
            || `${url.origin}/logo.png`;
        const fullUrl = `${url.origin}/lista/${slug}`;

        return generateBotHtml({ title, description, image, url: fullUrl });

    } catch (error) {
        console.error('OG Preview error:', error);
        return generateBotHtml({
            title: 'DuetLove - Crie sua Lista de Casamento',
            description: 'Crie sua lista de presentes de casamento online. Grátis e fácil de usar!',
            image: `${url.origin}/logo.png`,
            url: url.toString(),
        });
    }
}

/**
 * Generate minimal HTML with OG meta tags for bots
 */
function generateBotHtml(meta: {
    title: string;
    description: string;
    image: string;
    url: string;
}): Response {
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.title)}</title>
  
  <!-- Open Graph -->
  <meta property="og:type" content="website">
  <meta property="og:title" content="${escapeHtml(meta.title)}">
  <meta property="og:description" content="${escapeHtml(meta.description)}">
  <meta property="og:image" content="${escapeHtml(meta.image)}">
  <meta property="og:url" content="${escapeHtml(meta.url)}">
  <meta property="og:site_name" content="DuetLove">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(meta.title)}">
  <meta name="twitter:description" content="${escapeHtml(meta.description)}">
  <meta name="twitter:image" content="${escapeHtml(meta.image)}">
  
  <!-- Redirect human visitors to actual page -->
  <meta http-equiv="refresh" content="0;url=${escapeHtml(meta.url)}">
</head>
<body>
  <p>Redirecionando para <a href="${escapeHtml(meta.url)}">${escapeHtml(meta.title)}</a>...</p>
</body>
</html>`;

    return new Response(html, {
        status: 200,
        headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
    const map: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

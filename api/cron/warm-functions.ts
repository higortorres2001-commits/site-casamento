/**
 * Vercel Cron Handler for Warming Edge Functions
 * 
 * This API route is called by Vercel Cron every 5 minutes.
 * It pings critical Supabase Edge Functions to prevent cold starts.
 */

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error('Supabase configuration missing');
        return new Response('Configuration error', { status: 500 });
    }

    // Critical functions to warm (these are called frequently by users)
    const functionsToWarm = [
        'search-guests',      // RSVP search
        'check-user-exists',  // Onboarding email check
    ];

    const results: Record<string, { success: boolean; duration: number }> = {};

    for (const fn of functionsToWarm) {
        const start = Date.now();
        try {
            const response = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                },
                body: JSON.stringify({ _warmup: true }),
            });

            results[fn] = {
                success: response.ok || response.status === 400, // 400 = validation error, but function is warm
                duration: Date.now() - start,
            };
        } catch (error: any) {
            results[fn] = {
                success: false,
                duration: Date.now() - start,
            };
            console.error(`Failed to warm ${fn}:`, error.message);
        }
    }

    console.log('Edge Functions warmed:', results);

    return new Response(JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        results,
    }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

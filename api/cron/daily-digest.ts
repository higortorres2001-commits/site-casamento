/**
 * Vercel Cron Handler for Daily Digest
 * 
 * This API route is called by Vercel Cron at 23:00 UTC (20:00 BRT).
 * It triggers the Supabase Edge Function to send daily digest emails.
 * 
 * Security: Uses CRON_SECRET to authenticate the request to Supabase.
 */

export const config = {
    runtime: 'edge',
};

export default async function handler(request: Request) {
    // Only allow GET requests (Vercel Cron uses GET)
    if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
    const CRON_SECRET = process.env.CRON_SECRET;

    if (!SUPABASE_URL) {
        console.error('SUPABASE_URL not configured');
        return new Response('Configuration error', { status: 500 });
    }

    try {
        // Call the Supabase Edge Function
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-daily-digest`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-cron-secret': CRON_SECRET || '',
            },
            body: JSON.stringify({ trigger: 'vercel-cron' }),
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('Daily digest failed:', result);
            return new Response(JSON.stringify({
                success: false,
                error: result.error || 'Unknown error'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log('Daily digest completed:', result);

        return new Response(JSON.stringify({
            success: true,
            ...result
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Cron error:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

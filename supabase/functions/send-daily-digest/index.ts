// @ts-ignore
declare const Deno: any;
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { generateDailyDigestEmail, sendEmail } from '../_shared/email-templates.ts';
import { Sentry, initSentry } from '../_shared/sentry.ts';

initSentry();

/**
 * Send Daily Digest Email
 * 
 * This function should be called once per day (e.g., 20:00 BRT via Vercel Cron).
 * It aggregates all activity since the last digest and sends a single summary email
 * to each couple with new activity.
 * 
 * Security: Should be called with a secret token to prevent abuse.
 */

serve(async (req: Request) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    // Validate cron secret (optional but recommended)
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');

    if (expectedSecret && cronSecret !== expectedSecret) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Lista de Casamento <noreply@listadecasamento.com>';
    const APP_URL = Deno.env.get('APP_URL') || 'https://app.listadecasamento.com';

    if (!RESEND_API_KEY) {
        console.warn('RESEND_API_KEY not configured');
        return new Response(JSON.stringify({
            success: false,
            error: 'Email service not configured'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    try {
        const now = new Date();
        let emailsSent = 0;
        let listsProcessed = 0;

        // Get all active wedding lists with their owners
        const { data: weddingLists, error: listError } = await supabase
            .from('wedding_lists')
            .select(`
        id,
        bride_name,
        groom_name,
        user_id,
        last_digest_sent_at,
        notification_email,
        profiles!wedding_lists_user_id_fkey(email)
      `)
            .eq('is_public', true);

        if (listError) {
            throw new Error(`Failed to fetch wedding lists: ${listError.message}`);
        }

        for (const list of weddingLists || []) {
            listsProcessed++;

            const coupleNames = `${list.bride_name} & ${list.groom_name}`;
            const sinceDate = list.last_digest_sent_at || new Date(0).toISOString();

            // Get couple's email
            const coupleEmail = list.notification_email || (list as any).profiles?.email;

            if (!coupleEmail) {
                console.warn(`No email for wedding list ${list.id}`);
                continue;
            }

            // Fetch new RSVPs since last digest
            const { data: newRsvps } = await supabase
                .from('rsvp_responses')
                .select('guest_name, companions_count')
                .eq('wedding_list_id', list.id)
                .eq('attending', 'yes')
                .gt('created_at', sinceDate);

            // Fetch new gift purchases since last digest
            // We need to get reservations for this list's gifts (filtered below)
            const { data: giftReservations } = await supabase
                .from('gift_reservations')
                .select(`
          guest_name,
          quantity,
          total_price,
          gift_id,
          gifts(name, price)
        `)
                .eq('status', 'purchased')
                .gt('payment_confirmed_at', sinceDate);

            // Filter reservations for this wedding list's gifts
            const { data: listGifts } = await supabase
                .from('gifts')
                .select('id')
                .eq('wedding_list_id', list.id);

            const listGiftIds = new Set((listGifts || []).map((g: { id: string }) => g.id));

            const relevantReservations = (giftReservations || []).filter((r: { gift_id: string }) =>
                listGiftIds.has(r.gift_id)
            );

            // Fetch new messages since last digest
            const { count: newMessagesCount } = await supabase
                .from('guest_messages')
                .select('*', { count: 'exact', head: true })
                .eq('wedding_list_id', list.id)
                .gt('created_at', sinceDate);

            // Prepare digest data
            const digestData = {
                coupleNames,
                newRsvps: (newRsvps || []).map((r: { guest_name: string; companions_count: number }) => ({
                    name: r.guest_name,
                    companions: r.companions_count
                })),
                newGifts: relevantReservations.map((r: any) => ({
                    name: r.gifts?.name || 'Presente',
                    guestName: r.guest_name,
                    amount: r.total_price || r.gifts?.price || 0
                })),
                newMessages: newMessagesCount || 0,
                totalGiftAmount: relevantReservations.reduce((sum: number, r: any) =>
                    sum + (r.total_price || r.gifts?.price || 0), 0
                ),
                dashboardUrl: `${APP_URL}/dashboard`,
            };

            // Generate email (returns null if no activity)
            const emailContent = generateDailyDigestEmail(digestData);

            if (!emailContent) {
                // No activity, skip this list
                continue;
            }

            // Send email
            const result = await sendEmail(
                RESEND_API_KEY,
                coupleEmail,
                emailContent,
                { from: EMAIL_FROM }
            );

            if (result.success) {
                emailsSent++;
                console.log(`Digest sent to ${coupleEmail} for list ${list.id}`);

                // Update last_digest_sent_at
                await supabase
                    .from('wedding_lists')
                    .update({ last_digest_sent_at: now.toISOString() })
                    .eq('id', list.id);
            } else {
                console.error(`Failed to send digest to ${coupleEmail}:`, result.error);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            listsProcessed,
            emailsSent,
            timestamp: now.toISOString()
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error in send-daily-digest:', error);
        Sentry.captureException(error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

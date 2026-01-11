import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getCorsHeaders } from '../_shared/cors.ts';
import { generateGiftReceiptEmail, sendEmail } from '../_shared/email-templates.ts';

/**
 * Send Gift Receipt Email
 * 
 * Called after payment confirmation to send a receipt to the guest.
 * This is an immediate email (not batched) for trust/anti-fraud purposes.
 */

interface RequestBody {
    guestName: string;
    guestEmail: string;
    giftName: string;
    amount: number;
    quantity?: number;
    coupleNames: string;
}

serve(async (req) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
        const EMAIL_FROM = Deno.env.get('EMAIL_FROM') || 'Lista de Casamento <noreply@listadecasamento.com>';

        if (!RESEND_API_KEY) {
            console.warn('RESEND_API_KEY not configured, skipping email');
            return new Response(JSON.stringify({
                success: false,
                error: 'Email service not configured'
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        const body: RequestBody = await req.json();

        // Validate required fields
        if (!body.guestEmail || !body.guestName || !body.giftName || !body.amount || !body.coupleNames) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Missing required fields'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Generate email content
        const emailContent = generateGiftReceiptEmail({
            guestName: body.guestName,
            giftName: body.giftName,
            amount: body.amount,
            quantity: body.quantity,
            coupleNames: body.coupleNames,
        });

        // Send email
        const result = await sendEmail(
            RESEND_API_KEY,
            body.guestEmail,
            emailContent,
            { from: EMAIL_FROM }
        );

        if (!result.success) {
            console.error('Failed to send gift receipt:', result.error);
            return new Response(JSON.stringify({
                success: false,
                error: result.error
            }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        console.log(`Gift receipt sent to ${body.guestEmail}`);

        return new Response(JSON.stringify({
            success: true,
            message: 'Receipt email sent'
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error in send-gift-receipt:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

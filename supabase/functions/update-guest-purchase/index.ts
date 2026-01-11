import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Update Guest Purchase Status
 * 
 * After a successful gift purchase, updates:
 * 1. guest.has_purchased_gift = true
 * 2. Creates/updates RSVP with attending = 'maybe' (spent money = likely attending)
 * 
 * Input: { guest_id: string, wedding_list_id: string, guest_name: string, guest_phone: string }
 * Output: { success: boolean }
 */
serve(async (req) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin);

    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    try {
        const { guest_id, wedding_list_id, guest_name, guest_phone } = await req.json();

        // Update guest has_purchased_gift flag if guest_id provided
        if (guest_id) {
            const { error: guestUpdateError } = await supabase
                .from('guests')
                .update({ has_purchased_gift: true })
                .eq('id', guest_id);

            if (guestUpdateError) {
                console.error('Error updating guest:', guestUpdateError);
                // Continue anyway - non-critical
            } else {
                console.log('Updated guest has_purchased_gift for:', guest_id);
            }
        }

        // Create or update RSVP if we have wedding_list_id and guest info
        if (wedding_list_id && (guest_name || guest_phone)) {
            // Check for existing RSVP by phone
            const { data: existingRsvp, error: rsvpCheckError } = await supabase
                .from('rsvp_responses')
                .select('id')
                .eq('wedding_list_id', wedding_list_id)
                .eq('guest_phone', guest_phone)
                .maybeSingle();

            if (rsvpCheckError) {
                console.error('Error checking RSVP:', rsvpCheckError);
            }

            if (existingRsvp) {
                // Update existing RSVP to 'maybe' (if not already 'yes')
                const { error: rsvpUpdateError } = await supabase
                    .from('rsvp_responses')
                    .update({
                        attending: 'maybe',
                        message: 'Atualizou status após comprar presente.'
                    })
                    .eq('id', existingRsvp.id)
                    .neq('attending', 'yes'); // Don't downgrade from 'yes'

                if (rsvpUpdateError) {
                    console.error('Error updating RSVP:', rsvpUpdateError);
                } else {
                    console.log('Updated RSVP to maybe for:', guest_phone);
                }
            } else if (guest_name && guest_phone) {
                // Create new RSVP entry
                const { error: rsvpInsertError } = await supabase
                    .from('rsvp_responses')
                    .insert({
                        wedding_list_id,
                        guest_name,
                        guest_email: '', // Not required
                        guest_phone,
                        attending: 'maybe',
                        companions: 0,
                        message: 'Criado automaticamente após compra de presente.'
                    });

                if (rsvpInsertError) {
                    console.error('Error creating RSVP:', rsvpInsertError);
                } else {
                    console.log('Created RSVP for:', guest_name);
                }
            }
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        console.error('Error:', error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});

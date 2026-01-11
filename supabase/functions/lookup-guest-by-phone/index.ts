import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Lookup Guest by Phone
 * 
 * Searches for a guest by phone number in the guests table.
 * Used during gift checkout to auto-identify guests.
 * 
 * Input: { phone: string, wedding_list_id: string }
 * Output: { found: boolean, guest?: { id, name, group_name, envelope_id } }
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
        const { phone, wedding_list_id } = await req.json();

        if (!phone) {
            return new Response(JSON.stringify({ error: 'Phone is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        if (!wedding_list_id) {
            return new Response(JSON.stringify({ error: 'Wedding list ID is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Clean phone number to digits only for comparison
        const cleanPhone = phone.replace(/\D/g, '');

        // Search for guest by phone within the wedding list's envelopes
        const { data: guests, error: guestError } = await supabase
            .from('guests')
            .select(`
        id,
        name,
        whatsapp,
        envelope_id,
        has_purchased_gift,
        envelopes!inner (
          id,
          group_name,
          wedding_list_id
        )
      `)
            .eq('envelopes.wedding_list_id', wedding_list_id);

        if (guestError) {
            console.error('Error searching guests:', guestError);
            return new Response(JSON.stringify({ error: 'Failed to search guests' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        // Find matching guest by cleaned phone number
        const matchedGuest = guests?.find(g => {
            if (!g.whatsapp) return false;
            const guestCleanPhone = g.whatsapp.replace(/\D/g, '');
            return guestCleanPhone === cleanPhone ||
                guestCleanPhone.endsWith(cleanPhone) ||
                cleanPhone.endsWith(guestCleanPhone);
        });

        if (matchedGuest) {
            console.log('Found guest:', matchedGuest.name);
            return new Response(JSON.stringify({
                found: true,
                guest: {
                    id: matchedGuest.id,
                    name: matchedGuest.name,
                    group_name: (matchedGuest.envelopes as any).group_name,
                    envelope_id: matchedGuest.envelope_id,
                    has_purchased_gift: matchedGuest.has_purchased_gift
                }
            }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({
            found: false
        }), {
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

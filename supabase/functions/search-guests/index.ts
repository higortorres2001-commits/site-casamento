import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    // Handle CORS
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const { query, weddingListId } = await req.json();

        // 1. Rate Limiting Check
        const clientIp = req.headers.get("x-forwarded-for") || "unknown";

        // Call the database function to check rate limit
        // Limit: 20 requests per minute per IP for this endpoint
        const { data: allowed, error: rateLimitError } = await supabaseClient.rpc(
            'check_rate_limit',
            {
                p_ip_address: clientIp,
                p_endpoint: 'search-guests',
                p_limit: 20,
                p_window_minutes: 1
            }
        );

        if (rateLimitError) {
            console.error("Rate limit error:", rateLimitError);
            // Default to allowing if DB check fails to avoid outage, or block? 
            // Better to block if security is concern, but fail-open for UX. 
            // Given "Enumeration" concern, failing open might be bad.
            // Let's assume strict for now.
            return new Response(
                JSON.stringify({ error: "Rate limit check failed" }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429
                }
            );
        }

        if (allowed === false) {
            return new Response(
                JSON.stringify({ error: "Too many requests. Please try again later." }),
                {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    status: 429
                }
            );
        }

        // 2. Validate Input
        if (!query || query.length < 3) {
            return new Response(
                JSON.stringify({ guests: [] }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }

        // 3. Perform Secure Search using two parallel queries
        // Search by guest name AND by envelope group_name (family name)
        // This ensures "Família Torres" finds all guests in that group

        const searchPattern = `%${query}%`;

        // Query 1: Search by guest name
        const guestsByNamePromise = supabaseClient
            .from("guests")
            .select(`
                id,
                name,
                guest_type,
                envelope_id,
                envelopes!inner (
                    wedding_list_id,
                    group_name
                )
            `)
            .eq("envelopes.wedding_list_id", weddingListId)
            .ilike("name", searchPattern)
            .limit(10);

        // Query 2: Search by envelope group_name
        const guestsByGroupPromise = supabaseClient
            .from("guests")
            .select(`
                id,
                name,
                guest_type,
                envelope_id,
                envelopes!inner (
                    wedding_list_id,
                    group_name
                )
            `)
            .eq("envelopes.wedding_list_id", weddingListId)
            .ilike("envelopes.group_name", searchPattern)
            .limit(10);

        // Run both queries in parallel
        const [guestsByNameResult, guestsByGroupResult] = await Promise.all([
            guestsByNamePromise,
            guestsByGroupPromise
        ]);

        if (guestsByNameResult.error) throw guestsByNameResult.error;
        if (guestsByGroupResult.error) throw guestsByGroupResult.error;

        // Combine and deduplicate results
        const allGuests = [...(guestsByNameResult.data || []), ...(guestsByGroupResult.data || [])];
        const seenIds = new Set<string>();
        const uniqueGuests = allGuests.filter((g: any) => {
            if (seenIds.has(g.id)) return false;
            seenIds.add(g.id);
            return true;
        }).slice(0, 10); // Keep limit to prevent scraping

        // Map results to be client-friendly/safe
        // Do NOT expose phone numbers or emails here
        const safeGuests = uniqueGuests.map((g: any) => ({
            id: g.id,
            name: g.name,
            guest_type: g.guest_type,
            group_name: g.envelopes?.group_name || "",
            envelope_id: g.envelope_id
        }));

        return new Response(
            JSON.stringify({ guests: safeGuests }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            }
        );

    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 500
            }
        );
    }
});

-- Create a table for tracking rate limits
CREATE TABLE IF NOT EXISTS public.rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    request_count INTEGER DEFAULT 1,
    last_request_at TIMESTAMPTZ DEFAULT now(),
    reset_at TIMESTAMPTZ DEFAULT (now() + interval '1 hour')
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_ip_endpoint ON public.rate_limits(ip_address, endpoint);

-- Function to check and increment rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
    p_ip_address TEXT,
    p_endpoint TEXT,
    p_limit INTEGER,
    p_window_minutes INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_limit_record public.rate_limits%ROWTYPE;
    v_reset_time TIMESTAMPTZ;
BEGIN
    v_reset_time := now() + (p_window_minutes || ' minutes')::INTERVAL;

    SELECT * INTO v_limit_record
    FROM public.rate_limits
    WHERE ip_address = p_ip_address AND endpoint = p_endpoint;

    IF v_limit_record IS NULL THEN
        INSERT INTO public.rate_limits (ip_address, endpoint, request_count, reset_at)
        VALUES (p_ip_address, p_endpoint, 1, v_reset_time);
        RETURN TRUE;
    END IF;

    IF v_limit_record.reset_at < now() THEN
        UPDATE public.rate_limits
        SET request_count = 1,
            last_request_at = now(),
            reset_at = v_reset_time
        WHERE id = v_limit_record.id;
        RETURN TRUE;
    END IF;

    IF v_limit_record.request_count >= p_limit THEN
        RETURN FALSE;
    END IF;

    UPDATE public.rate_limits
    SET request_count = request_count + 1,
        last_request_at = now()
    WHERE id = v_limit_record.id;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_rate_limit TO anon, authenticated, service_role;
GRANT ALL ON public.rate_limits TO service_role;

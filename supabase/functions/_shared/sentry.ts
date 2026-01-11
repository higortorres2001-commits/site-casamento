import * as Sentry from "npm:@sentry/deno";

export const initSentry = () => {
    Sentry.init({
        dsn: Deno.env.get("SENTRY_DSN"),
        tracesSampleRate: 1.0,
    });
};

export const wrapHandler = (handler: (req: Request) => Promise<Response>) => {
    initSentry();
    return async (req: Request) => {
        try {
            return await handler(req);
        } catch (error) {
            Sentry.captureException(error);
            console.error(error);

            // Re-throw or return error response depending on strategy
            // For now, let's return a 500 but ensure we logged it
            return new Response(JSON.stringify({ error: "Internal Server Error" }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            });
        }
    };
};

export { Sentry };

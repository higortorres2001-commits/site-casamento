import * as Sentry from "@sentry/react";

/**
 * Initialize Sentry for the Frontend (React/Vite).
 * This file should be imported at the very top of the application entry point (main.tsx).
 * 
 * Configuration is controlled by the VITE_SENTRY_DSN environment variable.
 * If the variable is not present (e.g. local dev without .env), Sentry will not initialize,
 * which is expected behavior to avoid spamming the project with local errors.
 */

if (import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
        dsn: import.meta.env.VITE_SENTRY_DSN,

        // Integrations
        integrations: [
            Sentry.browserTracingIntegration(),
            Sentry.replayIntegration(),
        ],

        // Performance Monitoring
        // Capture 10% of transactions in production to reduce quota usage
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

        // Session Replay
        // Capture 0% of random sessions (save quota)
        replaysSessionSampleRate: 0.0,

        // BUT capture 100% of sessions that have an error
        // This allows us to see exactly what the user did before the crash
        replaysOnErrorSampleRate: 1.0,

        // Environment context
        environment: import.meta.env.MODE,
    });

    console.log("Monitoring initialized");
} else {
    console.log("Monitoring disabled: VITE_SENTRY_DSN not found");
}
